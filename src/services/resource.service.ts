import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    const { readdirSync } = require("node:fs");
    return readdirSync(dir, { withFileTypes: true })
      .filter((e: { name: string }) => !e.name.startsWith("."))
      .map((e: { name: string }) => e.name);
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
      return selectedPackages.includes(src);
    });
    cfg.packages = filtered;
    writeFileSync(dest, JSON.stringify(cfg, null, 2));
  } catch {
    cpSync(src, dest);
  }
}

/** Copy a single config file from source to profile */
export function copyConfigFile(
  name: string,
  source: string,
  filename: string,
): void {
  const dest = join(profilePath(name), filename);
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  const src = join(sourceDir(source), filename);
  if (existsSync(src)) cpSync(src, dest);
}

/** Copy loose directory items from source to profile */
export function copyLooseDirItems(
  name: string,
  source: string,
  key: CopyableDir,
  items: string[],
): void {
  const dest = join(profilePath(name), key);
  if (items.length === 0) {
    mkdirSync(dest, { recursive: true });
    return;
  }
  mkdirSync(dest, { recursive: true });
  for (const item of items) {
    const srcItem = join(sourceDir(source), key, item);
    const dstItem = join(dest, item);
    if (existsSync(srcItem)) {
      if (existsSync(dstItem)) rmSync(dstItem, { recursive: true, force: true });
      cpSync(srcItem, dstItem, { recursive: true });
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

/** List all items in a profile directory (both loose and package-managed) */
export function listAllProfileItems(
  name: string,
  key: CopyableDir,
): string[] {
  const dir = join(profilePath(name), key);
  if (!existsSync(dir)) return [];
  try {
    const { readdirSync } = require("node:fs");
    return readdirSync(dir, { withFileTypes: true })
      .filter((e: { name: string }) => !e.name.startsWith("."))
      .map((e: { name: string }) => e.name);
  } catch {
    return [];
  }
}
