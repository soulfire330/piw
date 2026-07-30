import { intro, log, outro } from "@clack/prompts";
import { listProfiles } from "../utils/profile.js";
import { isInherited } from "../utils/symlinks.js";

export async function list(): Promise<void> {
  intro("piw — Profiles");

  const profiles = listProfiles();

  if (profiles.length === 0) {
    log.warn("No profiles found in ~/.pi/profiles/");
    log.info('Create one with: piw (then choose "Create")');
    outro("Done");
    return;
  }

  log.info(`Found ${profiles.length} profile(s):\n`);

  for (const p of profiles) {
    const inherited: string[] = [];
    const local: string[] = [];

    for (const [key, val] of Object.entries(p.inherits)) {
      const actual = isInherited(p.name, key as never);
      if (val && actual) {
        inherited.push(key);
      } else if (!val && !actual) {
        local.push(key);
      } else {
        // Config doesn't match reality — show mismatch
        local.push(`${key} (mismatch: config=${val}, disk=${actual})`);
      }
    }

    log.message(
      [
        `▸ ${p.name}`,
        `  Created: ${new Date(p.createdAt).toLocaleDateString()}`,
        `  Inherited (symlinked): ${inherited.length ? inherited.join(", ") : "none"}`,
        `  Local: ${local.length ? local.join(", ") : "none"}`,
        "",
      ].join("\n"),
    );
  }

  outro("Done");
}
