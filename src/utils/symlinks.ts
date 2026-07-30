import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import type { CopyableDir, CopyableFile } from "../types.js";
import { COPYABLE_DIRS } from "../types.js";

const BASE = `${process.env.HOME}/.pi/agent`;

export function basePath(): string {
  return BASE;
}

export function profilePath(name: string): string {
  return `${process.env.HOME}/.pi/profiles/${name}`;
}

/** Always symlink auth.json from base */
export function applyAuth(name: string): void {
  const dest = join(profilePath(name), "auth.json");
  if (existsSync(dest)) {
    if (lstatSync(dest).isSymbolicLink()) unlinkSync(dest);
    else rmSync(dest, { force: true });
  }
  const src = join(BASE, "auth.json");
  if (existsSync(src)) symlinkSync(src, dest);
}

/** Clear a resource at dest */
function clear(dest: string): void {
  if (!existsSync(dest)) return;
  if (lstatSync(dest).isSymbolicLink()) unlinkSync(dest);
  else rmSync(dest, { recursive: true, force: true });
}

/**
 * Apply copy for a resource.
 * For files: items = undefined → copy the file, items = null → skip.
 * For dirs: items = string[] → copy only those items, [] → empty dir.
 */
export function applyCopy(
  name: string,
  key: CopyableFile | CopyableDir,
  items: string[] | null | undefined,
): void {
  const dest = join(profilePath(name), key);
  clear(dest);

  if (items === null) return; // skip

  const src = join(BASE, key);

  if (items === undefined) {
    // files: copy whole file
    if (existsSync(src)) cpSync(src, dest);
    return;
  }

  // dirs: per-item copy
  mkdirSync(dest, { recursive: true });
  for (const item of items) {
    const srcItem = join(src, item);
    const dstItem = join(dest, item);
    if (existsSync(srcItem)) cpSync(srcItem, dstItem, { recursive: true });
  }
}

/** List items in base for a given directory key */
export function listSourceItems(key: CopyableDir): string[] {
  if (!COPYABLE_DIRS.includes(key as never)) return [];
  const dir = join(BASE, key);
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => !e.name.startsWith("."))
      .map((e) => e.name);
  } catch {
    return [];
  }
}
