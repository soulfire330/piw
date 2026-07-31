import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CopyableDir } from "../types.js";
import { basePath, profilePath } from "./profile.service.js";

function sourceDir(source: string): string {
  return source === "_root_" ? basePath() : profilePath(source);
}

/** List items in a source directory (all, including package-managed) */
export function listSourceItems(source: string, key: CopyableDir): string[] {
  const dir = join(sourceDir(source), key);
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => !e.name.startsWith("."))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/** Copy settings.json from source to profile, keeping only selected packages */
export function copySettingsWithPackages(
  name: string,
  source: string,
  selectedPackages: string[],
): void {
  const src = join(sourceDir(source), "settings.json");
  const dest = join(profilePath(name), "settings.json");

  if (!existsSync(src)) return;

  try {
    const cfg = JSON.parse(readFileSync(src, "utf-8"));
    const raw: unknown[] = cfg.packages ?? [];
    const filtered = raw.filter((p) => {
      const src = typeof p === "string" ? p : (p as { source: string }).source;
      // ponytail: if pi adds versioned sources (npm:foo@1.2.3), normalize via parsePackageSource
      return selectedPackages.includes(src);
    });
    cfg.packages = filtered;
    writeFileSync(dest, JSON.stringify(cfg, null, 2));
  } catch {
    // If settings.json is malformed, don't silently copy — skip
    return;
  }
}

/** Copy a single config file from source to profile */
export function copyConfigFile(
  name: string,
  source: string,
  filename: string,
): void {
  const dest = join(profilePath(name), filename);
  const src = join(sourceDir(source), filename);
  if (existsSync(src)) cpSync(src, dest, { force: true, recursive: true });
}

/** Copy loose directory items from source to profile */
export function copyLooseDirItems(
  name: string,
  source: string,
  key: CopyableDir,
  items: string[],
): void {
  const dest = join(profilePath(name), key);
  mkdirSync(dest, { recursive: true });
  for (const item of items) {
    const srcItem = join(sourceDir(source), key, item);
    const dstItem = join(dest, item);
    if (existsSync(srcItem)) {
      cpSync(srcItem, dstItem, { force: true, recursive: true });
    }
  }
}

/** Delete a loose item from a profile directory */
export function deleteLooseItem(
  name: string,
  key: CopyableDir,
  item: string,
): void {
  const dest = join(profilePath(name), key, item);
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
}

