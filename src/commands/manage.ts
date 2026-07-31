import {
  cancel,
  confirm,
  groupMultiselect,
  intro,
  isCancel,
  log,
  outro,
  select,
} from "@clack/prompts";
import { COPYABLE_DIRS, COPYABLE_LABELS, type CopyableDir } from "../types.js";
import {
  readPackages,
  readPackagesFromDir,
  listLooseItems,
} from "../services/package.service.js";
import {
  listAllProfileDirs,
  profilePath,
} from "../services/profile.service.js";
import {
  copyLooseDirItems,
  deleteLooseItem,
  listSourceItems,
} from "../services/resource.service.js";
import { piInstall, piRemove } from "../services/pi.service.js";
import { rename } from "./rename.js";
import { deleteCmd } from "./delete.js";
import { show } from "./show.js";

// ── Copy from another profile ──────────────────────────────────

async function copyFromOther(name: string): Promise<void> {
  const home = process.env.HOME ?? "~";
  const otherProfiles = listAllProfileDirs().filter((d) => d !== name);

  const source = await select({
    message: "Copy from?",
    options: [
      { value: "_root_", label: "_root_", hint: `${home}/.pi/agent/` },
      ...otherProfiles.map((p) => ({
        value: p,
        label: p,
        hint: `${home}/.pi/profiles/${p}/`,
      })),
    ],
  });

  if (isCancel(source)) return;

  const src = source as string;
  const srcDir =
    src === "_root_"
      ? `${home}/.pi/agent`
      : `${home}/.pi/profiles/${src}`;

  // Pick packages and loose resources in one grouped multiselect
  const targetPkgs = new Set(readPackages(name).map((p) => p.source));
  const srcPkgs = readPackagesFromDir(srcDir);
  const newPkgs = srcPkgs.filter((p) => !targetPkgs.has(p.source));

  const groups: Record<string, Array<{ value: string; label: string; hint?: string }>> = {};
  const inheritedPkgs: string[] = [];
  const dirItems: Record<string, string[]> = {};

  if (newPkgs.length > 0) {
    groups["Packages"] = newPkgs.map((p) => ({
      value: `pkg:${p.source}`,
      label: p.source,
      hint: "package",
    }));
  }

  for (const d of COPYABLE_DIRS) {
    const srcItems = listSourceItems(src, d);
    const curItems = listLooseItems(name, d);
    const newItems = srcItems.filter((i) => !curItems.includes(i));
    if (newItems.length > 0) {
      groups[COPYABLE_LABELS[d]] = newItems.map((item) => ({
        value: `loose:${d}:${item}`,
        label: item,
        hint: `${d}/`,
      }));
    }
  }

  const groupNames = Object.keys(groups);
  if (groupNames.length === 0) {
    log.info("Nothing to copy");
    return;
  }

  const picked = await groupMultiselect({
    message: `Copy items from ${src}?`,
    options: groups,
    groupSpacing: 1,
    selectableGroups: false,
    required: false,
  });

  if (isCancel(picked)) return;

  for (const v of (picked as string[]) ?? []) {
    if (v.startsWith("pkg:")) {
      inheritedPkgs.push(v.slice(4));
    } else if (v.startsWith("loose:")) {
      const colon1 = v.indexOf(":");
      const colon2 = v.indexOf(":", colon1 + 1);
      const d = v.slice(colon1 + 1, colon2);
      const item = v.slice(colon2 + 1);
      if (!dirItems[d]) dirItems[d] = [];
      dirItems[d]!.push(item);
    }
  }

  const pkgCount = inheritedPkgs.length;
  const looseCount = Object.values(dirItems).flat().length;
  if (pkgCount === 0 && looseCount === 0) {
    log.info("Nothing to copy");
    return;
  }

  const summary = [
    pkgCount > 0 ? `${pkgCount} package(s)` : "",
    looseCount > 0 ? `${looseCount} loose resource(s)` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const ok = await confirm({
    message: `Copy from ${src} to ${name}? (${summary})`,
  });

  if (isCancel(ok) || !ok) return;

  // Install packages
  for (const p of inheritedPkgs) {
    const result = await piInstall(name, p);
    if (result.ok) {
      log.success(`Installed "${p}"`);
    } else {
      log.error(`Failed: "${p}" — ${result.error ?? "unknown"}`);
    }
  }

  // Copy loose
  for (const d of COPYABLE_DIRS) {
    const items = dirItems[d];
    if (items && items.length > 0) {
      copyLooseDirItems(name, src, d, items);
    }
  }

  log.success(`Copied ${summary} from ${src}`);
}

// ── Delete items ───────────────────────────────────────────────

async function deleteItems(name: string): Promise<void> {
  const toRemovePkgs: string[] = [];
  const toRemoveLoose: Array<{ dir: string; item: string }> = [];

  const groups: Record<string, Array<{ value: string; label: string; hint?: string }>> = {};

  // ── Packages group ──
  const pkgs = readPackages(name);
  if (pkgs.length > 0) {
    groups["Packages"] = pkgs.map((p) => ({
      value: `pkg:${p.source}`,
      label: p.source,
      hint: "package",
    }));
  }

  // ── Loose resource groups ──
  for (const d of COPYABLE_DIRS) {
    const items = listLooseItems(name, d);
    if (items.length > 0) {
      groups[COPYABLE_LABELS[d]] = items.map((item) => ({
        value: `loose:${d}:${item}`,
        label: item,
        hint: `${d}/`,
      }));
    }
  }

  const groupNames = Object.keys(groups);
  if (groupNames.length === 0) {
    log.info("Nothing to delete");
    return;
  }

  const picked = await groupMultiselect({
    message: `Delete items from "${name}"?`,
    options: groups,
    groupSpacing: 1,
    selectableGroups: false,
    required: false,
  });

  if (isCancel(picked)) return;

  for (const v of (picked as string[]) ?? []) {
    if (v.startsWith("pkg:")) {
      toRemovePkgs.push(v.slice(4));
    } else if (v.startsWith("loose:")) {
      const colon1 = v.indexOf(":");
      const colon2 = v.indexOf(":", colon1 + 1);
      const d = v.slice(colon1 + 1, colon2);
      const item = v.slice(colon2 + 1);
      toRemoveLoose.push({ dir: d, item });
    }
  }

  const pkgCount = toRemovePkgs.length;
  const looseCount = toRemoveLoose.length;
  if (pkgCount === 0 && looseCount === 0) {
    log.info("Nothing selected");
    return;
  }

  const summary = [
    pkgCount > 0 ? `${pkgCount} package(s)` : "",
    looseCount > 0 ? `${looseCount} loose resource(s)` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const ok = await confirm({
    message: `Delete from ${name}? (${summary})`,
  });

  if (isCancel(ok) || !ok) return;

  // Remove packages
  for (const p of toRemovePkgs) {
    const result = await piRemove(name, p);
    if (result.ok) {
      log.success(`Removed "${p}"`);
    } else {
      log.error(`Failed: "${p}" — ${result.error ?? "unknown"}`);
    }
  }

  // Delete loose
  for (const { dir, item } of toRemoveLoose) {
    deleteLooseItem(name, dir as CopyableDir, item);
  }

  log.success(`Deleted ${summary}`);
}

// ── Main ───────────────────────────────────────────────────────

export async function manage(): Promise<void> {
  intro("piw — Manage Profile");

  const profiles = listAllProfileDirs();

  if (profiles.length === 0) {
    log.warn("No profiles found. Create one first.");
    outro("Done");
    return;
  }

  const target = await select({
    message: "Select profile:",
    options: profiles.map((name) => ({ value: name, label: name })),
  });

  if (isCancel(target)) {
    cancel("Cancelled");
    return;
  }

  const action = await select({
    message: `Manage "${target}"`,
    options: [
      { value: "show", label: "Show resources" },
      { value: "copy", label: "Copy from another profile" },
      { value: "delete", label: "Delete items" },
      { value: "rename", label: "Rename profile" },
      { value: "rm", label: "Delete profile" },
    ],
  });

  if (isCancel(action)) {
    cancel("Cancelled");
    return;
  }

  if (action === "show") {
    await show(target);
  } else if (action === "rename") {
    await rename(target);
  } else if (action === "rm") {
    await deleteCmd(target);
  } else if (action === "copy") {
    await copyFromOther(target);
  } else if (action === "delete") {
    await deleteItems(target);
  }

  outro("Done");
}
