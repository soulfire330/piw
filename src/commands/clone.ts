import type { CloneOptions } from "../types.js";
import { cpSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { COPYABLE_DIRS } from "../types.js";
import {
  createProfile,
  listAllProfileDirs,
  profilePath,
  validateProfileName,
} from "../services/profile.service.js";
import { readPackages } from "../services/package.service.js";
import { copyConfigFile, copyLooseDirItems } from "../services/resource.service.js";

export async function clone(
  sourceOrOpts?: string | CloneOptions,
  target?: string,
): Promise<void> {
  const opts: CloneOptions =
    typeof sourceOrOpts === "string"
      ? { source: sourceOrOpts, target }
      : (sourceOrOpts ?? {});

  let source = opts.source;

  if (!source) {
    const profiles = listAllProfileDirs();
    if (profiles.length === 0) {
      const { log } = await import("@clack/prompts");
      log.warn("No profiles to clone from. Create one first.");
      return;
    }

    const { cancel, isCancel, select } = await import("@clack/prompts");
    const chosen = await select({
      message: "Clone from:",
      options: profiles.map((n) => ({ value: n, label: n })),
    });

    if (isCancel(chosen)) {
      cancel("Cancelled");
      return;
    }

    source = chosen as string;
  }

  let targetName = opts.target;

  if (!targetName) {
    const { cancel, isCancel, text } = await import("@clack/prompts");
    const val = await text({
      message: "New profile name:",
      placeholder: `${source}-copy`,
      validate: (v) => validateProfileName(v as string),
    });

    if (isCancel(val)) {
      cancel("Cancelled");
      return;
    }

    targetName = val;
  }

  const srcDir = profilePath(source);
  if (!existsSync(srcDir)) {
    console.error(`Source profile "${source}" not found`);
    process.exit(1);
  }

  const dstDir = createProfile(targetName);

  // Copy settings.json (includes packages — Pi will auto-install on first launch)
  copyConfigFile(targetName, source, "settings.json");

  // Copy all loose resources
  for (const d of COPYABLE_DIRS) {
    const srcD = join(srcDir, d);
    if (!existsSync(srcD)) continue;
    const items = readdirSync(srcD, { withFileTypes: true })
      .filter((e) => !e.name.startsWith("."))
      .map((e) => e.name);
    if (items.length > 0) {
      copyLooseDirItems(targetName, source, d, items);
    }
  }

  // Also copy AGENTS.md, APPEND_SYSTEM.md if they exist
  for (const f of ["AGENTS.md", "APPEND_SYSTEM.md"]) {
    const srcF = join(srcDir, f);
    if (existsSync(srcF)) cpSync(srcF, join(dstDir, f));
  }

  const pkgs = readPackages(source);
  console.log(`Cloned "${source}" → "${targetName}"`);
  if (pkgs.length > 0) {
    console.log(`${pkgs.length} package(s) declared — Pi will install them on first launch`);
  }
  console.log(`Launch with: piw ${targetName}`);
}
