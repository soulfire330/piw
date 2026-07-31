import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  multiselect,
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

  // Step 1: Pick packages from source that are not already in target
  const targetPkgs = new Set(readPackages(name).map((p) => p.source));
  const srcPkgs = readPackagesFromDir(srcDir);
  const newPkgs = srcPkgs.filter((p) => !targetPkgs.has(p.source));

  let inheritedPkgs: string[] = [];

  if (newPkgs.length > 0) {
    const picked = await multiselect({
      message: `Install packages from ${src}? (${newPkgs.length} new)`,
      options: newPkgs.map((p) => ({ value: p.source, label: p.source })),
      initialValues: newPkgs.map((p) => p.source),
      required: false,
    });

    if (isCancel(picked)) return;
    inheritedPkgs = (picked as string[]) ?? [];
  } else {
    log.info("No new packages to copy");
  }

  // Step 2: Pick loose resources (only those not in target)
  const dirItems: Record<string, string[]> = {};

  for (const d of COPYABLE_DIRS) {
    const srcItems = listSourceItems(src, d);
    const curItems = listLooseItems(name, d);
    const newItems = srcItems.filter((i) => !curItems.includes(i));

    if (newItems.length === 0) continue;

    const picked = await multiselect({
      message: `Copy loose ${d} from ${src}? (${newItems.length} new)`,
      options: newItems.map((item) => ({ value: item, label: item })),
      initialValues: newItems,
      required: false,
    });

    if (isCancel(picked)) return;
    const items = (picked as string[]) ?? [];
    if (items.length > 0) dirItems[d] = items;
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
  const options: Array<{ value: string; label: string; hint?: string }> = [];

  // Packages
  const pkgs = readPackages(name);
  for (const p of pkgs) {
    options.push({ value: `pkg\0${p.source}`, label: p.source, hint: "package" });
  }

  // Loose resources
  for (const d of COPYABLE_DIRS) {
    const items = listLooseItems(name, d);
    for (const item of items) {
      options.push({
        value: `loose\0${d}\0${item}`,
        label: item,
        hint: `${d}/`,
      });
    }
  }

  if (options.length === 0) {
    log.info("Nothing to delete");
    return;
  }

  const picked = await multiselect({
    message: `Delete items from ${name}:`,
    options,
    required: false,
  });

  if (isCancel(picked)) return;

  const selected = (picked as string[]) ?? [];
  if (selected.length === 0) return;

  const toRemovePkgs: string[] = [];
  const toRemoveLoose: Array<{ dir: string; item: string }> = [];

  for (const v of selected) {
    const parts = v.split("\0");
    if (parts[0] === "pkg") {
      toRemovePkgs.push(parts[1]!);
    } else if (parts[0] === "loose") {
      toRemoveLoose.push({ dir: parts[1]!, item: parts[2]! });
    }
  }

  const summary = [
    toRemovePkgs.length > 0 ? `${toRemovePkgs.length} package(s)` : "",
    toRemoveLoose.length > 0 ? `${toRemoveLoose.length} loose resource(s)` : "",
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
