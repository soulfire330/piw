import { cancel, confirm, isCancel, log, select } from "@clack/prompts";
import { deleteProfile, listAllProfileDirs } from "../services/profile.service.js";

export async function deleteCmd(name?: string): Promise<void> {
  let target = name;

  if (!target) {
    const profiles = listAllProfileDirs();
    if (profiles.length === 0) {
      log.warn("No profiles found.");
      return;
    }

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

  const ok = await confirm({
    message: `Delete profile "${target}"? This cannot be undone.`,
    initialValue: false,
  });

  if (isCancel(ok) || !ok) {
    cancel("Cancelled");
    return;
  }

  try {
    deleteProfile(target);
    log.success(`Profile "${target}" deleted`);
  } catch (err) {
    log.error((err as Error).message);
  }
}
