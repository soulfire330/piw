import { renameProfile } from "../services/profile.service.js";

export async function rename(name?: string, newName?: string): Promise<void> {
  if (!name) {
    const { log } = await import("@clack/prompts");
    log.error("Usage: piw rename <old-name> <new-name>");
    return;
  }

  if (!newName) {
    // Interactive: prompt for new name
    const { cancel, isCancel, text } = await import("@clack/prompts");
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
    console.log("Name unchanged");
    return;
  }

  try {
    renameProfile(name, newName);
    console.log(`Renamed "${name}" → "${newName}"`);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
