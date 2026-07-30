import { intro, log, outro } from "@clack/prompts";

import { COPYABLE_DIRS, COPYABLE_FILES, COPYABLE_LABELS } from "../types.js";
import { listProfiles } from "../utils/profile.js";

function fileDesc(on: boolean): string {
  return on ? "copy from base" : "none";
}

function dirDesc(items: string[]): string {
  if (items.length === 0) return "none";
  return `${items.length} items: ${items.join(", ")}`;
}

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
    const lines: string[] = [
      `▸ ${p.name}`,
      `  Created: ${new Date(p.createdAt).toLocaleDateString()}`,
    ];

    for (const f of COPYABLE_FILES) {
      lines.push(`  ${COPYABLE_LABELS[f]}: ${fileDesc(p.config.files[f])}`);
    }
    for (const d of COPYABLE_DIRS) {
      lines.push(`  ${COPYABLE_LABELS[d]}: ${dirDesc(p.config.dirs[d])}`);
    }

    log.message(`${lines.join("\n")}\n`);
  }

  outro("Done");
}
