import type { DeleteOptions } from "../types.js";
import { deleteProfile, listAllProfileDirs } from "../services/profile.service.js";

export async function deleteCmd(nameOrOpts?: string | DeleteOptions): Promise<void> {
  const opts: DeleteOptions =
    typeof nameOrOpts === "string" ? { name: nameOrOpts } : (nameOrOpts ?? {});

  let target = opts.name;

  if (!target) {
    const profiles = listAllProfileDirs();
    if (profiles.length === 0) {
      const { log } = await import("@clack/prompts");
      log.warn("No profiles found.");
      return;
    }

    const { cancel, isCancel, select } = await import("@clack/prompts");
    const chosen = await select({
      message: "Select profile to delete:",
      options: profiles.map((n) => ({ value: n, label: n })),
    });

    if (isCancel(chosen)) {
      cancel("Cancelled");
      return;
    }

    target = chosen as string;
  }

  // Skip confirmation when --yes is passed
  if (!opts.yes) {
    const { confirm, isCancel, cancel } = await import("@clack/prompts");
    const ok = await confirm({
      message: `Delete profile "${target}"? This cannot be undone.`,
      initialValue: false,
    });

    if (isCancel(ok) || !ok) {
      cancel("Cancelled");
      return;
    }
  }

  try {
    deleteProfile(target);
    console.log(`Profile "${target}" deleted`);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
