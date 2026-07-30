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
import type { InheritableKey, InheritEntry } from "../types.js";
import {
  INHERIT_LABELS,
  INHERITABLE_DIRS,
  INHERITABLE_FILES,
} from "../types.js";
import { createProfile, listAllProfileDirs } from "../utils/profile.js";
import { listSourceItems } from "../utils/symlinks.js";

/** Build source-select options (Base, profiles, None) */
function sourceOptions(
  profiles: string[],
): Array<{ value: string; label: string; hint?: string }> {
  const home = process.env.HOME ?? "~";
  const options: Array<{ value: string; label: string; hint?: string }> = [
    { value: "base", label: "Base", hint: `${home}/.pi/agent/` },
  ];
  for (const p of profiles) {
    options.push({
      value: p,
      label: p,
      hint: `${home}/.pi/profiles/${p}/`,
    });
  }
  options.push({ value: "none", label: "None", hint: "empty placeholder" });
  return options;
}

/** Prompt source then action, returning InheritEntry | null (null = None).
 *  Returns undefined if user cancelled. */
async function pickEntry(
  profiles: string[],
  message: string,
): Promise<InheritEntry | null | undefined> {
  const source = await select({
    message: `${message} — from?`,
    options: sourceOptions(profiles),
  });

  if (isCancel(source)) return undefined;
  if (source === "none") return null;

  const action = await select({
    message: `${message} — how?`,
    options: [
      { value: "inherit", label: "Inherit (symlink)", hint: "link to source" },
      { value: "copy", label: "Copy", hint: "copy from source" },
    ],
  });

  if (isCancel(action)) return undefined;
  return { source: source as string, action: action as "copy" | "inherit" };
}

/** Like pickEntry but for directories — adds item-level multiselect. */
async function pickDirEntry(
  profiles: string[],
  key: InheritableKey,
): Promise<InheritEntry | null | undefined> {
  const label = INHERIT_LABELS[key];
  const entry = await pickEntry(profiles, label);

  if (entry === undefined || entry === null) return entry;

  // Scan source for available items
  const items = listSourceItems(entry, key);

  if (items.length === 0) {
    // No items in source — just create empty dir
    entry.items = [];
    return entry;
  }

  const selected = await groupMultiselect({
    message: `Which ${label.split(" ")[0]} to ${entry.action === "inherit" ? "inherit" : "copy"}?`,
    options: {
      Items: items.map((item) => ({ value: item, label: item })),
    },
    initialValues: items,
    required: false,
  });

  if (isCancel(selected)) return undefined;

  entry.items = (selected as string[]) ?? [];
  return entry;
}

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
  const inherits: Record<string, InheritEntry | null> = {};

  // Phase 1: Bulk for config files
  const bulkSource = await select({
    message: "Base configuration — from?",
    options: [
      ...sourceOptions(profiles).filter((o) => o.value !== "none"),
      {
        value: "_custom",
        label: "Select independently...",
        hint: "per-file choice",
      },
    ],
  });

  if (isCancel(bulkSource)) {
    cancel("Cancelled");
    return;
  }

  if (bulkSource === "_custom") {
    for (const key of INHERITABLE_FILES) {
      const entry = await pickEntry(
        profiles,
        INHERIT_LABELS[key as InheritableKey],
      );
      if (entry === undefined) {
        cancel("Cancelled");
        return;
      }
      inherits[key] = entry;
    }
  } else {
    const action = await select({
      message: "Base configuration — how?",
      options: [
        {
          value: "inherit",
          label: "Inherit (symlink)",
          hint: "links to source",
        },
        { value: "copy", label: "Copy", hint: "copies from source" },
      ],
    });

    if (isCancel(action)) {
      cancel("Cancelled");
      return;
    }

    const entry: InheritEntry = {
      source: bulkSource as string,
      action: action as "copy" | "inherit",
    };
    for (const key of INHERITABLE_FILES) inherits[key] = entry;
  }

  // Phase 2: Directories — individual with per-item multiselect
  for (const key of INHERITABLE_DIRS) {
    const entry = await pickDirEntry(profiles, key as InheritableKey);
    if (entry === undefined) {
      cancel("Cancelled");
      return;
    }
    inherits[key] = entry;
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
          inherits as Record<InheritableKey, InheritEntry | null>,
        );
        return `Profile "${name}" created at ~/.pi/profiles/${name}/`;
      },
    },
  ]);

  log.success(`Launch with: piw ${name}`);
  outro("Done");
}
