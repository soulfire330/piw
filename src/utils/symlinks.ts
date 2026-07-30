import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import type { InheritableKey, InheritEntry } from "../types.js";
import { INHERITABLE_DIRS } from "../types.js";

const BASE = `${process.env.HOME}/.pi/agent`;

/** Get the base Pi path (~/.pi/agent) */
export function basePath(): string {
  return BASE;
}

/** Get profile directory path */
export function profilePath(name: string): string {
  return `${process.env.HOME}/.pi/profiles/${name}`;
}

/** Underlying resource path inside a profile */
function resourcePath(profile: string, key: InheritableKey): string {
  return join(profilePath(profile), key);
}

/** Resolve source path for a given entry */
function sourcePath(entry: InheritEntry, key: InheritableKey): string {
  if (entry.source === "base") {
    return join(BASE, key);
  }
  return join(profilePath(entry.source), key);
}

/** Remove existing resource at dest (symlink or real) */
function clearResource(dest: string): void {
  if (!existsSync(dest)) return;
  if (lstatSync(dest).isSymbolicLink()) {
    unlinkSync(dest);
  } else {
    rmSync(dest, { recursive: true, force: true });
  }
}

/** Apply an InheritEntry to a profile key.
 *  null = "none" → create empty dir or skip for files. */
export function applyInheritEntry(
  profile: string,
  key: InheritableKey,
  entry: InheritEntry | null,
): void {
  const dest = resourcePath(profile, key);
  clearResource(dest);

  if (entry === null) {
    // None: create empty directory for dirs, skip files
    if (INHERITABLE_DIRS.includes(key as never)) {
      mkdirSync(dest, { recursive: true });
    }
    return;
  }

  const src = sourcePath(entry, key);

  if (entry.action === "inherit") {
    if (!existsSync(src)) {
      // Source doesn't exist — fall back to empty placeholder
      if (INHERITABLE_DIRS.includes(key as never)) {
        mkdirSync(dest, { recursive: true });
      }
      return;
    }
    symlinkSync(src, dest);
  } else {
    // copy
    if (existsSync(src)) {
      cpSync(src, dest, { recursive: true });
    } else {
      if (INHERITABLE_DIRS.includes(key as never)) {
        mkdirSync(dest, { recursive: true });
      }
    }
  }
}

/** Check if a resource in a profile is a symlink (inherited) */
export function isInherited(profile: string, key: InheritableKey): boolean {
  const p = resourcePath(profile, key);
  if (!existsSync(p)) return false;
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

/** Read where a symlink points to (for display) */
export function symlinkTarget(
  profile: string,
  key: InheritableKey,
): string | null {
  const p = resourcePath(profile, key);
  if (!existsSync(p)) return null;
  try {
    if (!lstatSync(p).isSymbolicLink()) return null;
    return readlinkSync(p);
  } catch {
    return null;
  }
}
