import {
  cancel,
  confirm,
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

/** Parse a flat string value back to InheritEntry | null */
function decodeEntry(raw: string): InheritEntry | null {
  if (raw === "none") return null;
  const sep = raw.lastIndexOf(":");
  const source = raw.slice(0, sep);
  const action = raw.slice(sep + 1) as "copy" | "inherit";
  return { source, action };
}

/** Build select options for a single resource */
function buildOptions(
  profiles: string[],
): Array<{ value: string; label: string; hint?: string }> {
  const options: Array<{ value: string; label: string; hint?: string }> = [];

  // Base
  options.push({
    value: "base:inherit",
    label: "Base → Inherit (symlink)",
    hint: "link to ~/.pi/agent/",
  });
  options.push({
    value: "base:copy",
    label: "Base → Copy",
    hint: "copy from ~/.pi/agent/",
  });

  // Existing profiles
  for (const p of profiles) {
    options.push({
      value: `${p}:inherit`,
      label: `${p} → Inherit (symlink)`,
    });
    options.push({
      value: `${p}:copy`,
      label: `${p} → Copy`,
    });
  }

  // None
  options.push({
    value: "none",
    label: "None (empty placeholder)",
    hint: "create empty, skip for files",
  });

  return options;
}

const ALL_KEYS: InheritableKey[] = [
  ...INHERITABLE_FILES,
  ...INHERITABLE_DIRS,
] as InheritableKey[];

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
  const options = buildOptions(profiles);
  const inherits: Record<string, InheritEntry | null> = {};

  // Prompt per resource
  for (const key of ALL_KEYS) {
    const entry = await select({
      message: `${INHERIT_LABELS[key]} — where from?`,
      options,
    });

    if (isCancel(entry)) {
      cancel("Cancelled");
      return;
    }

    inherits[key] = decodeEntry(entry as string);
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
