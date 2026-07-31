import { cancel, isCancel, log, text } from "@clack/prompts";
import { renameProfile } from "../services/profile.service.js";

export async function rename(name?: string, newName?: string): Promise<void> {
  if (!name) {
    log.error("Usage: piw rename <old-name> <new-name>");
    return;
  }

  if (!newName) {
    const val = await text({
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

    if (isCancel(val)) {
      cancel("Cancelled");
      return;
    }

    newName = val;
  }

  if (newName === name) {
    log.info("Name unchanged");
    return;
  }

  try {
    renameProfile(name, newName);
    log.success(`Renamed "${name}" → "${newName}"`);
  } catch (err) {
    log.error((err as Error).message);
  }
}
