import type { ListOptions } from "../types.js";
import { COPYABLE_DIRS, COPYABLE_LABELS } from "../types.js";
import { readPackages, listLooseItems } from "../services/package.service.js";
import { listProfiles } from "../services/profile.service.js";
import { readExtends } from "../services/inherit.service.js";

export async function list(opts?: ListOptions): Promise<void> {
  const profiles = listProfiles();

  if (opts?.json) {
    const out = profiles.map((p) => {
      const pkgs = readPackages(p.name);
      const resources: Record<string, string[]> = {};
      for (const d of COPYABLE_DIRS) {
        resources[d] = listLooseItems(p.name, d);
      }
      return {
        name: p.name,
        createdAt: p.createdAt.toISOString(),
        extends: readExtends(p.name),
        packages: pkgs.map((x) => ({ source: x.source, kind: x.kind })),
        resources,
      };
    });
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  // Interactive path
  const { intro, log, outro } = await import("@clack/prompts");

  intro("piw — Profiles");

  if (profiles.length === 0) {
    log.warn("No profiles found in ~/.pi/profiles/");
    log.info('Create one with: piw (then choose "Create")');
    outro("Done");
    return;
  }

  log.info(`Found ${profiles.length} profile(s):\n`);

  for (const p of profiles) {
    const pkgs = readPackages(p.name);
    const ext = readExtends(p.name);
    const lines: string[] = [
      `▸ ${p.name}`,
      `  Created: ${p.createdAt.toLocaleDateString()}`,
      ...(ext.length > 0 ? [`  Extends: ${ext.join(", ")}`] : []),
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
