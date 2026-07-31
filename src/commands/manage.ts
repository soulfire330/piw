import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  multiselect,
  outro,
  select,
  text,
} from "@clack/prompts";
import type { CopyableDir } from "../types.js";
import { COPYABLE_DIRS, COPYABLE_LABELS } from "../types.js";
import {
  readPackages,
  isItemLoose,
  listLooseItems,
  listPackageItems,
} from "../services/package.service.js";
import {
  listAllProfileDirs,
  profilePath,
} from "../services/profile.service.js";
import {
  copyLooseDirItems,
  deleteLooseItem,
  listAllProfileItems,
  listSourceItems,
} from "../services/resource.service.js";
import { piInstall, piRemove } from "../services/pi.service.js";
import { rename } from "./rename.js";
import { deleteCmd } from "./delete.js";

function dirLabel(items: string[]): string {
  if (items.length === 0) return "none";
  return `${items.length} items: ${items.join(", ")}`;
}

// ── Packages ──────────────────────────────────────────────────

async function managePackages(name: string): Promise<void> {
  while (true) {
    const pkgs = readPackages(name);
    const pkgsWithStatus = pkgs.map((p) => ({
      value: p.source,
      label: p.source,
    }));

    const action = await select({
      message: `Packages (${pkgs.length}) — manage:`,
      options: [
        { value: "_add", label: "Add package..." },
        ...(pkgs.length > 0
          ? [{ value: "_remove", label: "Remove package..." }]
          : []),
        ...(pkgs.length > 0
          ? [
              {
                value: "_list",
                label: "Show package resources...",
              },
            ]
          : []),
        { value: "done", label: "Back" },
      ],
    });

    if (isCancel(action) || action === "done") return;

    if (action === "_add") {
      const pkg = await text({
        message: "Package to add:",
        placeholder: "npm:some-package or git:github.com/user/repo",
        validate: (v) => {
          if (!v || v.trim().length === 0) return "Package is required";
          return undefined;
        },
      });

      if (isCancel(pkg)) continue;

      const ok = await confirm({
        message: `Add "${pkg}" to ${name}?`,
      });
      if (isCancel(ok) || !ok) continue;

      const result = await piInstall(name, pkg);
      if (result.ok) {
        log.success(`Added "${pkg}"`);
      } else {
        log.error(result.error ?? "Failed");
      }
    } else if (action === "_remove") {
      const picked = await multiselect({
        message: "Select packages to remove:",
        options: pkgsWithStatus,
        required: false,
      });

      if (isCancel(picked)) continue;

      const toRemove = (picked as string[]) ?? [];
      if (toRemove.length === 0) continue;

      const ok = await confirm({
        message: `Remove ${toRemove.length} package(s) from ${name}?`,
      });
      if (isCancel(ok) || !ok) continue;

      for (const pkg of toRemove) {
        const result = await piRemove(name, pkg);
        if (result.ok) {
          log.success(`Removed "${pkg}"`);
        } else {
          log.error(result.error ?? `Failed to remove "${pkg}"`);
        }
      }
    } else if (action === "_list") {
      const pkgItems = listPackageItems(name, "skills");
      const extItems = listPackageItems(name, "extensions");
      const promptItems = listPackageItems(name, "prompts");
      const themeItems = listPackageItems(name, "themes");

      const all = new Map<string, string[]>();
      for (const [k, v] of [
        ...pkgItems,
        ...extItems,
        ...promptItems,
        ...themeItems,
      ]) {
        all.set(k, [...(all.get(k) ?? []), ...v]);
      }

      if (all.size === 0) {
        log.info("No package-provided resources detected");
      } else {
        log.info("Package-provided resources:");
        for (const [pkgId, items] of all) {
          log.message(`  ${pkgId}: ${items.join(", ")}`);
        }
      }
      // pause
      await confirm({ message: "Press enter to continue" });
    }
  }
}

// ── Loose Resources ───────────────────────────────────────────

async function copyFromOther(
  name: string,
  key: CopyableDir,
): Promise<void> {
  const home = process.env.HOME ?? "~";
  const allDirs = listAllProfileDirs().filter((d) => d !== name);

  const source = await select({
    message: `Copy loose ${key} from?`,
    options: [
      { value: "base", label: "Base", hint: `${home}/.pi/agent/` },
      ...allDirs.map((p) => ({
        value: p,
        label: p,
        hint: `${home}/.pi/profiles/${p}/`,
      })),
    ],
  });

  if (isCancel(source)) return;

  const src = source as string;
  const available = listSourceItems(src, key);

  if (available.length === 0) {
    log.warn(`No items in ${src}/${key}/`);
    return;
  }

  const current = listLooseItems(name, key);
  const newItems = available.filter((i) => !current.includes(i));

  if (newItems.length === 0) {
    log.info("All loose items already present");
    return;
  }

  const picked = await multiselect({
    message: `Select loose ${key} to copy from ${src}:`,
    options: newItems.map((item) => ({ value: item, label: item })),
    initialValues: newItems,
    required: false,
  });

  if (isCancel(picked)) return;

  const toAdd = (picked as string[]) ?? [];
  if (toAdd.length === 0) return;

  const ok = await confirm({
    message: `Copy ${toAdd.length} loose item(s) from ${src} to ${name}?`,
  });
  if (isCancel(ok) || !ok) return;

  copyLooseDirItems(name, src, key, [...current, ...toAdd]);
  log.success(`Copied ${toAdd.length} loose item(s)`);
}

async function deleteLooseItems(
  name: string,
  key: CopyableDir,
): Promise<void> {
  const items = listLooseItems(name, key);

  if (items.length === 0) {
    log.info(`No loose items in ${key}/`);
    return;
  }

  const picked = await multiselect({
    message: `Select loose ${key} to delete:`,
    options: items.map((item) => ({ value: item, label: item })),
    required: false,
  });

  if (isCancel(picked)) return;

  const toDelete = (picked as string[]) ?? [];
  if (toDelete.length === 0) return;

  const ok = await confirm({
    message: `Delete ${toDelete.length} loose item(s) from ${name}?`,
  });
  if (isCancel(ok) || !ok) return;

  for (const item of toDelete) {
    deleteLooseItem(name, key, item);
  }
  log.success(`Deleted ${toDelete.length} loose item(s)`);
}

async function manageResource(
  name: string,
  key: CopyableDir,
): Promise<void> {
  const allItems = listAllProfileItems(name, key);
  const looseItems = listLooseItems(name, key);
  const pkgItems = listPackageItems(name, key);
  const pkgItemSet = new Set<string>();
  for (const [, items] of pkgItems) {
    for (const i of items) pkgItemSet.add(i);
  }

  const label = dirLabel(allItems);
  const hint = looseItems.length > 0
    ? `(${looseItems.length} loose, ${pkgItemSet.size} from packages)`
    : "";

  const action = await select({
    message: `${COPYABLE_LABELS[key]} — ${label} ${hint}`,
    options: [
      { value: "_copy", label: "Copy loose from other..." },
      ...(looseItems.length > 0
        ? [{ value: "_delete", label: "Delete loose..." }]
        : []),
      ...(pkgItemSet.size > 0
        ? [
            {
              value: "_showpkg",
              label: "Show package items...",
            },
          ]
        : []),
      { value: "done", label: "Back" },
    ],
  });

  if (isCancel(action) || action === "done") return;

  if (action === "_copy") await copyFromOther(name, key);
  else if (action === "_delete") await deleteLooseItems(name, key);
  else if (action === "_showpkg") {
    log.info(`Package-provided ${key}:`);
    for (const [pkgId, items] of pkgItems) {
      log.message(`  ${pkgId}: ${items.join(", ")}`);
    }
    await confirm({ message: "Press enter to continue" });
    await manageResource(name, key);
  }
}

async function doResources(name: string): Promise<void> {
  while (true) {
    const allKeys = COPYABLE_DIRS.map((k) => {
      const all = listAllProfileItems(name, k);
      return {
        value: k,
        label: COPYABLE_LABELS[k],
        hint: dirLabel(all),
      };
    });

    const chosen = await select({
      message: `Resources for "${name}"`,
      options: [
        { value: "_packages", label: "Manage packages..." },
        ...allKeys,
        { value: "done", label: "Back" },
      ],
    });

    if (isCancel(chosen) || chosen === "done") return;

    if (chosen === "_packages") {
      await managePackages(name);
    } else {
      await manageResource(name, chosen as CopyableDir);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────

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
      { value: "resources", label: "Manage resources" },
      { value: "rename", label: "Rename profile" },
      { value: "delete", label: "Delete profile" },
    ],
  });

  if (isCancel(action)) {
    cancel("Cancelled");
    return;
  }

  if (action === "rename") await rename(target);
  else if (action === "delete") await deleteCmd(target);
  else if (action === "resources") await doResources(target);

  outro("Done");
}
