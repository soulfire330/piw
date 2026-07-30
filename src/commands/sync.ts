import {
  cancel,
  groupMultiselect,
  intro,
  isCancel,
  log,
  outro,
  select,
  tasks,
} from "@clack/prompts";
import type { CopyableDir, CopyableFile } from "../types.js";
import { COPYABLE_DIRS, COPYABLE_FILES, COPYABLE_LABELS } from "../types.js";
import {
  listAllProfileDirs,
  listProfiles,
  readProfile,
  updateConfig,
} from "../utils/profile.js";
import { listSourceItems, sourceDir } from "../utils/symlinks.js";

function dirLabel(items: string[]): string {
  if (items.length === 0) return "none";
  return items.join(", ") || "(empty dir)";
}

function fileLabel(on: boolean): string {
  return on ? "copy" : "none";
}

export async function sync(): Promise<void> {
  intro("piw — Edit Copies");

  const profiles = listProfiles();

  if (profiles.length === 0) {
    log.warn("No piw-managed profiles found. Create one first.");
    outro("Done");
    return;
  }

  const target = await select({
    message: "Select profile to manage:",
    options: profiles.map((p) => ({ value: p.name, label: p.name })),
  });

  if (isCancel(target)) {
    cancel("Cancelled");
    return;
  }

  const cfg = readProfile(target);

  if (!cfg) {
    log.error(`Profile "${target}" not found`);
    outro("Done");
    return;
  }

  // Pick source
  const home = process.env.HOME ?? "~";
  const allDirs = listAllProfileDirs().filter((d) => d !== target);

  const src = await select({
    message: `Copy from? (currently: ${cfg.source})`,
    options: [
      { value: "base", label: "Base", hint: `${home}/.pi/agent/` },
      ...allDirs.map((p) => ({
        value: p,
        label: p,
        hint: `${home}/.pi/profiles/${p}/`,
      })),
      { value: cfg.source, label: `Keep current (${cfg.source})` },
    ],
  });

  if (isCancel(src)) {
    cancel("Cancelled");
    return;
  }

  const source = src === cfg.source ? cfg.source : (src as string);
  const srcLabel = source === "base" ? "Base" : source;

  // Build initial values: selected keys
  const initial: string[] = [];
  for (const f of COPYABLE_FILES) {
    if (cfg.files[f]) initial.push(f);
  }
  for (const d of COPYABLE_DIRS) {
    if (cfg.dirs[d].length > 0) initial.push(d);
  }

  const selected = await groupMultiselect({
    message: `What to copy from ${srcLabel} (${sourceDir(source)})?`,
    options: {
      "Config files": [...COPYABLE_FILES].map((k) => ({
        value: k,
        label: COPYABLE_LABELS[k],
        hint: `currently: ${fileLabel(cfg.files[k])}`,
      })),
      Directories: [...COPYABLE_DIRS].map((k) => ({
        value: k,
        label: COPYABLE_LABELS[k],
        hint: `currently: ${dirLabel(cfg.dirs[k])}`,
      })),
    },
    initialValues: initial,
    required: false,
  });

  if (isCancel(selected)) {
    cancel("Cancelled");
    return;
  }

  const sel = selected as string[];

  const files: Record<string, boolean> = {};
  for (const f of COPYABLE_FILES) files[f] = sel.includes(f);

  const dirs: Record<string, string[]> = {};

  for (const d of COPYABLE_DIRS) {
    if (!sel.includes(d)) {
      dirs[d] = [];
      continue;
    }

    const items = listSourceItems(source, d as CopyableDir);

    if (items.length === 0) {
      dirs[d] = [];
      continue;
    }

    const current = cfg.dirs[d];

    const picked = await groupMultiselect({
      message: `Which ${d} to copy?`,
      options: {
        Items: items.map((item) => ({ value: item, label: item })),
      },
      initialValues: current.length > 0 ? current : items,
      required: false,
    });

    if (isCancel(picked)) {
      cancel("Cancelled");
      return;
    }

    dirs[d] = (picked as string[]) ?? [];
  }

  // Detect changes
  const changes: string[] = [];
  if (cfg.source !== source) {
    changes.push(`source: ${cfg.source} → ${source}`);
  }
  for (const f of COPYABLE_FILES) {
    if (cfg.files[f] !== files[f]) {
      changes.push(
        `${COPYABLE_LABELS[f]}: ${fileLabel(cfg.files[f])} → ${fileLabel(files[f])}`,
      );
    }
  }
  for (const d of COPYABLE_DIRS) {
    const old = cfg.dirs[d];
    const neu = dirs[d];
    if (old.join(",") !== neu.join(",")) {
      changes.push(
        `${COPYABLE_LABELS[d]}: ${dirLabel(old)} → ${dirLabel(neu)}`,
      );
    }
  }

  if (changes.length === 0) {
    log.info("No changes");
    outro("Done");
    return;
  }

  log.info(`Changes:\n${changes.map((c) => `  ${c}`).join("\n")}`);

  await tasks([
    {
      title: "Updating copies",
      task: async () => {
        updateConfig(
          target,
          source,
          files as Record<CopyableFile, boolean>,
          dirs as Record<CopyableDir, string[]>,
        );
        return `${changes.length} resource(s) updated`;
      },
    },
  ]);

  log.success(`Profile "${target}" updated`);
  outro("Done");
}
