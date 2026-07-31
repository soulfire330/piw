import { intro, log, outro } from "@clack/prompts";
import { COPYABLE_DIRS, COPYABLE_LABELS } from "../types.js";
import { readPackages, listLooseItems } from "../services/package.service.js";
import { listProfiles } from "../services/profile.service.js";

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
    const pkgs = readPackages(p.name);
    const lines: string[] = [
      `▸ ${p.name}`,
      `  Created: ${p.createdAt.toLocaleDateString()}`,
      pkgs.length > 0
        ? `  Packages: ${pkgs.length} (${pkgs.map((x) => x.id).join(", ")})`
        : "  Packages: none",
    ];

    for (const d of COPYABLE_DIRS) {
      const loose = listLooseItems(p.name, d);
      lines.push(
        `  ${COPYABLE_LABELS[d]}: ${loose.length > 0 ? loose.join(", ") : "none"}`,
      );
    }

    log.message(`${lines.join("\n")}\n`);
  }

  outro("Done");
}
