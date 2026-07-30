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
import type { InheritableKey } from "../types.js";
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

/** Create a symlink from profile/<key> -> ~/.pi/agent/<key> */
export function inheritResource(profile: string, key: InheritableKey): void {
  const dest = resourcePath(profile, key);
  const src = join(BASE, key);

  // Remove existing if present
  if (existsSync(dest)) {
    if (lstatSync(dest).isSymbolicLink()) {
      unlinkSync(dest);
    } else {
      rmSync(dest, { recursive: true, force: true });
    }
  }

  symlinkSync(src, dest);
}

/** Remove symlink and replace with a local copy from base */
export function localizeResource(profile: string, key: InheritableKey): void {
  const dest = resourcePath(profile, key);
  const src = join(BASE, key);

  // Only act if it's currently a symlink or missing
  if (existsSync(dest)) {
    if (!lstatSync(dest).isSymbolicLink()) return; // already local
    unlinkSync(dest);
  }

  // Copy from base
  if (existsSync(src)) {
    cpSync(src, dest, { recursive: true });
  } else {
    // Base resource doesn't exist — create empty
    if (INHERITABLE_DIRS.includes(key as never)) {
      mkdirSync(dest, { recursive: true });
    }
    // Files: skip if base doesn't have them
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
