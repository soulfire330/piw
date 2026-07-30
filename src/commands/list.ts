import { intro, log, outro } from "@clack/prompts";
import type { InheritableKey, InheritEntry } from "../types.js";
import { listProfiles } from "../utils/profile.js";
import { isInherited } from "../utils/symlinks.js";

function entryDesc(entry: InheritEntry | null): string {
  if (entry === null) return "none";
  const src = entry.source === "base" ? "Base" : entry.source;
  const act = entry.action === "inherit" ? "symlink" : "copy";
  return `${src}/${act}`;
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

    for (const [key, val] of Object.entries(p.inherits) as [
      InheritableKey,
      InheritEntry | null,
    ][]) {
      const isLink = isInherited(p.name, key);
      const config = entryDesc(val);
      const disk = isLink ? "symlink" : "local";
      const mismatch = (val?.action === "inherit") !== isLink ? " ⚠️" : "";
      lines.push(`  ${key}: ${config} (${disk})${mismatch}`);
    }

    log.message(`${lines.join("\n")}\n`);
  }

  outro("Done");
}
