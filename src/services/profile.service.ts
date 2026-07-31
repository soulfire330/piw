import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── Paths ─────────────────────────────────────────────────────

const PROFILES_DIR = `${process.env.HOME}/.pi/profiles`;

export function profilePath(name: string): string {
  return `${PROFILES_DIR}/${name}`;
}

export function basePath(): string {
  return `${process.env.HOME}/.pi/agent`;
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
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name);
}

export function listProfiles(): ProfileInfo[] {
  ensureProfilesDir();
  return readdirSync(PROFILES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => {
      const dir = profilePath(e.name);
      return { name: e.name, createdAt: statSync(dir).birthtime, dir };
    });
}

export function createProfile(name: string): string {
  ensureProfilesDir();
  const dir = profilePath(name);
  if (existsSync(dir)) throw new Error(`Profile "${name}" already exists`);
  mkdirSync(dir, { recursive: true });
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
