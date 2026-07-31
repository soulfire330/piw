import type { ShowOptions } from "../types.js";
import { existsSync } from "node:fs";
import { COPYABLE_DIRS, COPYABLE_LABELS } from "../types.js";
import {
  readPackages,
  listLooseItems,
  listPackageItems,
} from "../services/package.service.js";
import { listProfiles, profilePath } from "../services/profile.service.js";

export async function show(nameOrOpts?: string | ShowOptions): Promise<void> {
  const opts: ShowOptions =
    typeof nameOrOpts === "string" ? { name: nameOrOpts } : (nameOrOpts ?? {});

  let target = opts.name;

  if (!target) {
    const profiles = listProfiles();
    if (profiles.length === 0) {
      if (opts.json) {
        console.log(JSON.stringify({ error: "No profiles found" }));
        return;
      }
      const { log } = await import("@clack/prompts");
      log.warn("No profiles found. Create one first.");
      return;
    }
    target = profiles[0]!.name;
  }

  const dir = profilePath(target);
  if (!existsSync(dir)) {
    if (opts.json) {
      console.log(JSON.stringify({ error: `Profile "${target}" not found` }));
      return;
    }
    const { log } = await import("@clack/prompts");
    log.error(`Profile "${target}" not found`);
    return;
  }

  if (opts.json) {
    const profiles = listProfiles();
    const info = profiles.find((p) => p.name === target);
    const pkgs = readPackages(target);
    const loose: Record<string, string[]> = {};
    for (const d of COPYABLE_DIRS) {
      loose[d] = listLooseItems(target, d);
    }
    const pkgResources: Record<string, Record<string, string[]>> = {};
    for (const d of COPYABLE_DIRS) {
      for (const [pkgId, items] of listPackageItems(target, d)) {
        if (!pkgResources[pkgId]) pkgResources[pkgId] = {};
        pkgResources[pkgId]![d] = items;
      }
    }
    console.log(JSON.stringify({
      name: target,
      createdAt: info?.createdAt.toISOString() ?? null,
      path: dir,
      packages: pkgs.map((p) => ({ source: p.source, kind: p.kind })),
      looseResources: loose,
      packageResources: pkgResources,
    }, null, 2));
    return;
  }

  // Interactive path
  const { intro, log, outro } = await import("@clack/prompts");

  intro(`piw — Profile "${target}"`);

  const profiles = listProfiles();
  const info = profiles.find((p) => p.name === target);
  if (info) {
    log.info(`Created: ${info.createdAt.toLocaleString()}`);
  }
  log.info(`Path: ${dir}`);
  log.info("");

  // Packages
  const pkgs = readPackages(target);
  if (pkgs.length > 0) {
    log.info(`Packages (${pkgs.length}):`);
    for (const p of pkgs) {
      log.message(`  ${p.source}`);
    }
  } else {
    log.info("Packages: none");
  }
  log.info("");

  // Loose resources
  log.info("Loose resources:");
  for (const d of COPYABLE_DIRS) {
    const loose = listLooseItems(target, d);
    log.message(`  ${COPYABLE_LABELS[d]}: ${loose.join(", ") || "none"}`);
  }

  // Package-provided resources
  log.info("");
  log.info("Package-provided resources:");
  const pkgItems = listPackageItems(target, "skills");
  let hasPkgResources = false;
  for (const [pkgId, items] of pkgItems) {
    if (items.length > 0) {
      hasPkgResources = true;
      log.message(`  ${pkgId}: ${items.join(", ")}`);
    }
  }
  for (const d of ["extensions", "prompts", "themes"] as const) {
    const map = listPackageItems(target, d);
    for (const [pkgId, items] of map) {
      if (items.length > 0) {
        hasPkgResources = true;
        log.message(`  ${pkgId}/${d}: ${items.join(", ")}`);
      }
    }
  }
  if (!hasPkgResources) {
    log.info("  none");
  }

  outro("Done");
}
