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
import {
  INHERIT_LABELS,
  INHERITABLE_DIRS,
  INHERITABLE_FILES,
  type InheritableKey,
} from "../types.js";
import { listProfiles, readProfile, updateInherits } from "../utils/profile.js";

export async function sync(): Promise<void> {
  intro("piw — Sync Inheritance");

  const profiles = listProfiles();

  if (profiles.length === 0) {
    log.warn("No profiles found");
    outro("Done");
    return;
  }

  const target = await select({
    message: "Select profile to manage:",
    options: profiles.map((p) => ({
      value: p.name,
      label: p.name,
      hint: `${Object.values(p.inherits).filter(Boolean).length} inherited`,
    })),
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

  const currentInherited: InheritableKey[] = [];
  for (const [key, val] of Object.entries(cfg.inherits)) {
    if (val) currentInherited.push(key as InheritableKey);
  }

  const selected = await groupMultiselect({
    message: "Toggle inheritance (selected = symlinked from base Pi):",
    options: {
      Files: INHERITABLE_FILES.map((key) => ({
        value: key,
        label: INHERIT_LABELS[key],
      })),
      Directories: INHERITABLE_DIRS.map((key) => ({
        value: key,
        label: INHERIT_LABELS[key],
      })),
    },
    initialValues: currentInherited,
    required: false,
  });

  if (isCancel(selected)) {
    cancel("Cancelled");
    return;
  }

  // Build new inheritance map
  const newInherits = { ...cfg.inherits };
  for (const key of Object.keys(newInherits) as InheritableKey[])
    newInherits[key] = false;
  for (const s of selected) newInherits[s as InheritableKey] = true;

  // Find what changed
  const changes: string[] = [];
  for (const [key, was] of Object.entries(cfg.inherits)) {
    const now = newInherits[key as InheritableKey];
    if (was !== now) {
      changes.push(now ? `+ symlink ${key}` : `- localize ${key}`);
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
      title: "Updating inheritance",
      task: async () => {
        updateInherits(target, newInherits);
        return `${changes.length} resource(s) updated`;
      },
    },
  ]);

  log.success(`Profile "${target}" updated`);
  outro("Done");
}
