import { intro, log, outro } from "@clack/prompts";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { COPYABLE_DIRS, COPYABLE_LABELS } from "../types.js";
import {
  readPackages,
  listLooseItems,
  listPackageItems,
} from "../services/package.service.js";
import { listProfiles, profilePath } from "../services/profile.service.js";

export async function show(name?: string): Promise<void> {
  let target = name;

  if (!target) {
    const profiles = listProfiles();
    if (profiles.length === 0) {
      log.warn("No profiles found. Create one first.");
      return;
    }
    target = profiles[0]!.name;
    log.info(`Showing default: "${target}"`);
  }

  const dir = profilePath(target);
  if (!existsSync(dir)) {
    log.error(`Profile "${target}" not found`);
    return;
  }

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
