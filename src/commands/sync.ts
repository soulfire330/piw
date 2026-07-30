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
import { listProfiles, readProfile, updateConfig } from "../utils/profile.js";
import { listSourceItems } from "../utils/symlinks.js";

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

  // Build initial values: selected keys
  const initial: string[] = [];
  for (const f of COPYABLE_FILES) {
    if (cfg.files[f]) initial.push(f);
  }
  for (const d of COPYABLE_DIRS) {
    if (cfg.dirs[d].length > 0) initial.push(d);
  }

  const selected = await groupMultiselect({
    message: "Which resources to copy from base?",
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

  // Build new files config
  const files: Record<string, boolean> = {};
  for (const f of COPYABLE_FILES) files[f] = sel.includes(f);

  // Build new dirs config
  const dirs: Record<string, string[]> = {};

  for (const d of COPYABLE_DIRS) {
    if (!sel.includes(d)) {
      dirs[d] = [];
      continue;
    }

    const items = listSourceItems(d as CopyableDir);

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
