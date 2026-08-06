import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── Paths ─────────────────────────────────────────────────────

const PROFILES_DIR = `${process.env.HOME}/.pi/profiles`;

/** Reserved names that cannot be used as profile names */
export const RESERVED_NAMES = ["_root_"];

export function profilePath(name: string): string {
  return `${PROFILES_DIR}/${name}`;
}

/** Resolve a name to a directory — handles _root_ → base Pi dir */
export function resolvePath(name: string): string {
  return name === "_root_" ? basePath() : profilePath(name);
}

export function basePath(): string {
  return `${process.env.HOME}/.pi/agent`;
}

// ── Validation ─────────────────────────────────────────────────

/**
 * Syntactically safe profile identifier: letters, numbers, hyphens, underscores
 * only — no path separators or `..`, so it can never escape PROFILES_DIR when
 * concatenated into a path. Use this to guard any name that reaches the
 * filesystem (including `extends` parents read from settings.json).
 */
export function isSafeProfileName(name: string): boolean {
  return typeof name === "string" && /^[a-z0-9_-]+$/i.test(name);
}

export function validateProfileName(name: string): string | undefined {
  if (!name || name.trim().length === 0) return "Name is required";
  if (!isSafeProfileName(name))
    return "Only letters, numbers, hyphens, underscores";
  if (RESERVED_NAMES.includes(name))
    return `"${name}" is a reserved word`;
  const dir = profilePath(name);
  if (existsSync(dir)) return `Profile "${name}" already exists`;
  return undefined;
}

// ── Profile CRUD ──────────────────────────────────────────────

export interface ProfileInfo {
  name: string;
  createdAt: Date;
  dir: string;
}

export function ensureProfilesDir(): void {
  mkdirSync(PROFILES_DIR, { recursive: true });
}

export function listAllProfileDirs(): string[] {
  ensureProfilesDir();
  return readdirSync(PROFILES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !RESERVED_NAMES.includes(e.name))
    .map((e) => e.name);
}

export function listProfiles(): ProfileInfo[] {
  ensureProfilesDir();
  return readdirSync(PROFILES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !RESERVED_NAMES.includes(e.name))
    .map((e) => {
      const dir = profilePath(e.name);
      return { name: e.name, createdAt: statSync(dir).birthtime, dir };
    });
}

export function createProfile(name: string): string {
  ensureProfilesDir();
  const dir = profilePath(name);
  try {
    mkdirSync(dir); // atomic — throws EEXIST if already exists
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === "EEXIST")
      throw new Error(`Profile "${name}" already exists`);
    throw err;
  }
  mkdirSync(join(dir, "sessions"), { recursive: true });
  mkdirSync(join(dir, "memory"), { recursive: true });
  writeFileSync(join(dir, "AGENTS.md"), "");
  writeFileSync(join(dir, "APPEND_SYSTEM.md"), "");
  return dir;
}

export function deleteProfile(name: string): void {
  const dir = profilePath(name);
  if (!existsSync(dir)) throw new Error(`Profile "${name}" not found`);
  rmSync(dir, { recursive: true, force: true });
}

export function renameProfile(oldName: string, newName: string): void {
  const oldDir = profilePath(oldName);
  const newDir = profilePath(newName);
  if (!existsSync(oldDir)) throw new Error(`Profile "${oldName}" not found`);
  if (existsSync(newDir)) throw new Error(`Profile "${newName}" already exists`);
  renameSync(oldDir, newDir);
}
