import {
  cancel,
  confirm,
  groupMultiselect,
  intro,
  isCancel,
  log,
  outro,
  select,
  tasks,
  text,
} from "@clack/prompts";
import type { CopyableDir, ProfileConfig } from "../types.js";
import { COPYABLE_DIRS, COPYABLE_LABELS } from "../types.js";
import {
  deleteProfile,
  listAllProfileDirs,
  listProfiles,
  readProfile,
  renameProfile,
  updateConfig,
} from "../utils/profile.js";
import { applyCopy, listSourceItems } from "../utils/symlinks.js";

function dirLabel(items: string[]): string {
  if (items.length === 0) return "none";
  return `${items.length} items: ${items.join(", ")}`;
}

// ── Sub-actions ──────────────────────────────────────────────

async function doRename(name: string): Promise<void> {
  const newName = await text({
    message: `New name for "${name}":`,
    placeholder: "new-name",
    initialValue: name,
    validate: (v) => {
      if (!v || v.trim().length === 0) return "Name is required";
      if (!/^[a-z0-9_-]+$/i.test(v))
        return "Only letters, numbers, hyphens, underscores";
      return undefined;
    },
  });

  if (isCancel(newName)) {
    cancel("Cancelled");
    return;
  }

  if (newName === name) {
    log.info("Name unchanged");
    return;
  }

  await tasks([
    {
      title: `Renaming "${name}" → "${newName}"`,
      task: async () => {
        renameProfile(name, newName);
        return "Done";
      },
    },
  ]);
  log.success(`Renamed to "${newName}"`);
}

async function doDelete(name: string): Promise<void> {
  const ok = await confirm({
    message: `Delete profile "${name}"? This cannot be undone.`,
    active: "Delete",
    inactive: "Cancel",
    initialValue: false,
  });

  if (isCancel(ok) || !ok) {
    cancel("Cancelled");
    return;
  }

  deleteProfile(name);
  log.success(`Profile "${name}" deleted`);
}

// ── Resource management ──────────────────────────────────────

async function manageDir(
  name: string,
  cfg: ProfileConfig,
  key: CopyableDir,
): Promise<void> {
  while (true) {
    const items = cfg.dirs[key];
    const label = dirLabel(items);

    const action = await select({
      message: `${COPYABLE_LABELS[key]} — ${label}`,
      options: [
        ...(items.length > 0
          ? [{ value: "_items", label: "Manage items..." }]
          : []),
        { value: "_copyfrom", label: "Copy from other..." },
        { value: "done", label: "Back" },
      ],
    });

    if (isCancel(action) || action === "done") return;

    if (action === "_copyfrom") {
      await copyFromOther(name, cfg, key);
      continue;
    }

    if (action === "_items") {
      await manageDirItems(name, cfg, key);
    }
  }
}

async function manageDirItems(
  name: string,
  cfg: ProfileConfig,
  key: CopyableDir,
): Promise<void> {
  while (true) {
    const items = cfg.dirs[key];

    if (items.length === 0) {
      log.info(`No items in ${key}/`);
      return;
    }

    const chosen = await select({
      message: `${key}/ — select item:`,
      options: [
        ...items.map((item) => ({ value: item, label: item })),
        { value: "done", label: "Back" },
      ],
    });

    if (isCancel(chosen) || chosen === "done") return;

    const action = await select({
      message: `${chosen}`,
      options: [
        { value: "delete", label: "Delete" },
        { value: "back", label: "Back" },
      ],
    });

    if (isCancel(action) || action === "back") continue;

    const ok = await confirm({
      message: `Delete "${chosen}" from ${key}/?`,
      active: "Delete",
      inactive: "Cancel",
      initialValue: false,
    });

    if (isCancel(ok) || !ok) continue;

    cfg.dirs[key] = items.filter((i) => i !== chosen);
    updateConfig(name, cfg.source, cfg.files, cfg.dirs);
    applyCopy(name, cfg.source, key, cfg.dirs[key]);
    log.success(`Deleted ${chosen} from ${key}/`);
  }
}
async function copyFromOther(
  name: string,
  cfg: ProfileConfig,
  key: CopyableDir,
): Promise<void> {
  const home = process.env.HOME ?? "~";
  const allDirs = listAllProfileDirs().filter((d) => d !== name);

  const source = await select({
    message: `Copy ${key} from?`,
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

  // Filter out items already present
  const newItems = available.filter((i) => !cfg.dirs[key].includes(i));

  if (newItems.length === 0) {
    log.info("All items already copied");
    return;
  }

  const picked = await groupMultiselect({
    message: `Which ${key} to copy from ${src}?`,
    options: {
      Items: newItems.map((item) => ({ value: item, label: item })),
    },
    initialValues: newItems,
    required: false,
  });

  if (isCancel(picked)) return;

  const toAdd = (picked as string[]) ?? [];
  if (toAdd.length === 0) return;

  cfg.dirs[key] = [...cfg.dirs[key], ...toAdd];
  updateConfig(name, cfg.source, cfg.files, cfg.dirs);
  applyCopy(name, cfg.source, key, cfg.dirs[key]);
  log.success(`Added ${toAdd.length} item(s) to ${key}/`);
}

async function doResources(name: string): Promise<void> {
  while (true) {
    const cfg = readProfile(name);
    if (!cfg) {
      log.error(`Profile "${name}" not found`);
      return;
    }

    const src = cfg.source === "base" ? "Base" : cfg.source;

    const allKeys = COPYABLE_DIRS.map((k) => ({
      value: k,
      label: COPYABLE_LABELS[k],
      hint: dirLabel(cfg.dirs[k]),
    }));

    const chosen = await select({
      message: `Resources (source: ${src})`,
      options: [...allKeys, { value: "done", label: "Back" }],
    });

    if (isCancel(chosen) || chosen === "done") return;

    await manageDir(name, cfg, chosen as CopyableDir);
  }
}

// ── Main ─────────────────────────────────────────────────────

export async function manage(): Promise<void> {
  intro("piw — Manage Profile");

  const profiles = listProfiles();

  if (profiles.length === 0) {
    log.warn("No piw-managed profiles found. Create one first.");
    outro("Done");
    return;
  }

  const target = await select({
    message: "Select profile:",
    options: profiles.map((p) => ({ value: p.name, label: p.name })),
  });

  if (isCancel(target)) {
    cancel("Cancelled");
    return;
  }

  const action = await select({
    message: `Manage "${target}"`,
    options: [
      { value: "rename", label: "Rename profile" },
      { value: "resources", label: "Manage resources" },
      { value: "delete", label: "Delete profile" },
    ],
  });

  if (isCancel(action)) {
    cancel("Cancelled");
    return;
  }

  if (action === "rename") await doRename(target);
  else if (action === "delete") await doDelete(target);
  else if (action === "resources") await doResources(target);

  outro("Done");
}
