import {
  cancel,
  intro,
  isCancel,
  log,
  outro,
  select,
  text,
} from "@clack/prompts";
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import { COPYABLE_DIRS } from "../types.js";
import {
  createProfile,
  listAllProfileDirs,
  profilePath,
} from "../services/profile.service.js";
import { readPackages } from "../services/package.service.js";
import { copyConfigFile, copyLooseDirItems } from "../services/resource.service.js";

export async function clone(source?: string, target?: string): Promise<void> {
  if (!source) {
    const profiles = listAllProfileDirs();
    if (profiles.length === 0) {
      log.warn("No profiles to clone from. Create one first.");
      return;
    }

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

  if (!target) {
    const val = await text({
      message: "New profile name:",
      placeholder: `${source}-copy`,
      validate: (v) => {
        if (!v || v.trim().length === 0) return "Name is required";
        if (!/^[a-z0-9_-]+$/i.test(v))
          return "Only letters, numbers, hyphens, underscores";
        return undefined;
      },
    });

    if (isCancel(val)) {
      cancel("Cancelled");
      return;
    }

    target = val;
  }

  const srcDir = profilePath(source);
  if (!existsSync(srcDir)) {
    log.error(`Source profile "${source}" not found`);
    return;
  }

  intro(`piw — Clone "${source}" → "${target}"`);

  const dstDir = createProfile(target);

  // Copy settings.json (includes packages — Pi will auto-install on first launch)
  copyConfigFile(target, source, "settings.json");

  // Copy all loose resources
  for (const d of COPYABLE_DIRS) {
    const srcD = join(srcDir, d);
    if (!existsSync(srcD)) continue;
    const { readdirSync } = require("node:fs") as typeof import("fs");
    const items = readdirSync(srcD, { withFileTypes: true })
      .filter((e: { name: string }) => !e.name.startsWith("."))
      .map((e: { name: string }) => e.name);
    if (items.length > 0) {
      copyLooseDirItems(target, source, d, items);
    }
  }

  // Also copy AGENTS.md, APPEND_SYSTEM.md if they exist
  for (const f of ["AGENTS.md", "APPEND_SYSTEM.md"]) {
    const srcF = join(srcDir, f);
    if (existsSync(srcF)) cpSync(srcF, join(dstDir, f));
  }

  const pkgs = readPackages(source);
  if (pkgs.length > 0) {
    log.info(
      `${pkgs.length} package(s) declared in settings.json — Pi will install them on first launch`,
    );
  }

  log.success(`Cloned "${source}" → "${target}"`);
  log.info(`Launch with: piw ${target}`);
  outro("Done");
}
