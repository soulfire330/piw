import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  outro,
  select,
} from "@clack/prompts";
import { deleteProfile, listProfiles } from "../utils/profile.js";

export async function delete_(): Promise<void> {
  intro("piw — Delete Profile");

  const profiles = listProfiles();

  if (profiles.length === 0) {
    log.warn("No profiles to delete");
    outro("Done");
    return;
  }

  const target = await select({
    message: "Select profile to delete:",
    options: profiles.map((p) => ({ value: p.name, label: p.name })),
  });

  if (isCancel(target)) {
    cancel("Cancelled");
    return;
  }

  const ok = await confirm({
    message: `Delete profile "${target}"? This cannot be undone.`,
    active: "Delete",
    inactive: "Cancel",
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
    log.error(`Failed: ${err instanceof Error ? err.message : err}`);
  }

  outro("Done");
}
