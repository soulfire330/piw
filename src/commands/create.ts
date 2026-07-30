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
import type { CopyableDir, CopyableFile } from "../types.js";
import { COPYABLE_DIRS, COPYABLE_FILES, COPYABLE_LABELS } from "../types.js";
import { createProfile, listAllProfileDirs } from "../utils/profile.js";
import { listSourceItems, sourceDir } from "../utils/symlinks.js";

export async function create(): Promise<void> {
  intro("piw — Create Profile");

  const name = await text({
    message: "Profile name:",
    placeholder: "my-agent",
    validate: (v) => {
      if (!v || v.trim().length === 0) return "Name is required";
      if (!/^[a-z0-9_-]+$/i.test(v))
        return "Only letters, numbers, hyphens, underscores";
      return undefined;
    },
  });

  if (isCancel(name)) {
    cancel("Cancelled");
    return;
  }

  const profiles = listAllProfileDirs();

  // Step 1: pick source
  const home = process.env.HOME ?? "~";
  const sourceOptions: Array<{ value: string; label: string; hint?: string }> =
    [
      { value: "base", label: "Base", hint: `${home}/.pi/agent/` },
      ...profiles.map((p) => ({
        value: p,
        label: p,
        hint: `${home}/.pi/profiles/${p}/`,
      })),
      { value: "none", label: "None", hint: "empty profile" },
    ];

  const src = await select({
    message: "Copy from?",
    options: sourceOptions,
  });

  if (isCancel(src)) {
    cancel("Cancelled");
    return;
  }

  const source = src as string;

  const files: Record<string, boolean> = {};
  const dirs: Record<string, string[]> = {};

  for (const f of COPYABLE_FILES) files[f] = false;
  for (const d of COPYABLE_DIRS) dirs[d] = [];

  // Step 2: if source != none, pick what to copy
  if (source !== "none") {
    const srcLabel = source === "base" ? "Base" : source;
    const srcHint = sourceDir(source);

    const selected = await groupMultiselect({
      message: `What to copy from ${srcLabel} (${srcHint})?`,
      options: {
        "Config files": [...COPYABLE_FILES].map((k) => ({
          value: k,
          label: COPYABLE_LABELS[k],
        })),
        Directories: [...COPYABLE_DIRS].map((k) => ({
          value: k,
          label: COPYABLE_LABELS[k],
        })),
      },
      required: false,
    });

    if (isCancel(selected)) {
      cancel("Cancelled");
      return;
    }

    const sel = selected as string[];
    for (const f of COPYABLE_FILES) files[f] = sel.includes(f);

    for (const d of COPYABLE_DIRS) {
      if (!sel.includes(d)) continue;

      const items = listSourceItems(source, d as CopyableDir);

      if (items.length === 0) continue;

      const picked = await groupMultiselect({
        message: `Which ${d} to copy?`,
        options: {
          Items: items.map((item) => ({ value: item, label: item })),
        },
        initialValues: items,
        required: false,
      });

      if (isCancel(picked)) {
        cancel("Cancelled");
        return;
      }

      dirs[d] = (picked as string[]) ?? [];
    }
  }

  const proceed = await confirm({
    message: `Create profile "${name}"?`,
    active: "Create",
    inactive: "Cancel",
  });

  if (isCancel(proceed) || !proceed) {
    cancel("Cancelled");
    return;
  }

  await tasks([
    {
      title: `Creating profile "${name}"`,
      task: async () => {
        createProfile(
          name,
          source,
          files as Record<CopyableFile, boolean>,
          dirs as Record<CopyableDir, string[]>,
        );
        return `Profile "${name}" created at ~/.pi/profiles/${name}/`;
      },
    },
  ]);

  log.success(`Launch with: piw ${name}`);
  outro("Done");
}
