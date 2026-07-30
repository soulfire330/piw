import {
  cancel,
  confirm,
  groupMultiselect,
  intro,
  isCancel,
  log,
  outro,
  tasks,
  text,
} from "@clack/prompts";
import type { CopyableDir, CopyableFile } from "../types.js";
import { COPYABLE_DIRS, COPYABLE_FILES, COPYABLE_LABELS } from "../types.js";
import { createProfile } from "../utils/profile.js";
import { listSourceItems } from "../utils/symlinks.js";

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

  // Step 1: groupMultiselect — what to copy from base?
  const selected = await groupMultiselect({
    message: "What to copy from base (~/.pi/agent/)?",
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

  // Build files config
  const files: Record<string, boolean> = {};
  for (const f of COPYABLE_FILES) files[f] = sel.includes(f);

  // Build dirs config — ask per-dir which items
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
