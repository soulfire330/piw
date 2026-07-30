import {
  cancel,
  intro,
  isCancel,
  log,
  outro,
  select,
  tasks,
  text,
} from "@clack/prompts";
import { listProfiles, renameProfile } from "../utils/profile.js";

export async function rename(): Promise<void> {
  intro("piw — Rename Profile");

  const profiles = listProfiles();

  if (profiles.length === 0) {
    log.warn("No profiles to rename");
    outro("Done");
    return;
  }

  const target = await select({
    message: "Select profile to rename:",
    options: profiles.map((p) => ({ value: p.name, label: p.name })),
  });

  if (isCancel(target)) {
    cancel("Cancelled");
    return;
  }

  const newName = await text({
    message: `New name for "${target}":`,
    placeholder: "new-name",
    initialValue: target,
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

  if (newName === target) {
    log.info("Name unchanged");
    outro("Done");
    return;
  }

  try {
    await tasks([
      {
        title: `Renaming "${target}" → "${newName}"`,
        task: async () => {
          renameProfile(target, newName);
          return "Done";
        },
      },
    ]);
    log.success(`Renamed to "${newName}"`);
  } catch (err) {
    log.error(`Failed: ${err instanceof Error ? err.message : err}`);
  }

  outro("Done");
}
