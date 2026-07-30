import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type {
  CopyableDir,
  CopyableFile,
  ProfileConfig,
  ProfileInfo,
} from "../types.js";
import { COPYABLE_DIRS, COPYABLE_FILES } from "../types.js";
import { applyAuth, applyCopy, profilePath } from "./symlinks.js";

const PROFILES_DIR = `${process.env.HOME}/.pi/profiles`;

export function ensureProfilesDir(): void {
  if (!existsSync(PROFILES_DIR)) {
    mkdirSync(PROFILES_DIR, { recursive: true });
  }
}

/** Default config: nothing copied, source = base */
export function defaultConfig(): ProfileConfig {
  const files: Record<string, boolean> = {};
  for (const f of COPYABLE_FILES) files[f] = false;

  const dirs: Record<string, string[]> = {};
  for (const d of COPYABLE_DIRS) dirs[d] = [];

  return {
    name: "",
    createdAt: "",
    source: "base",
    files: files as Record<CopyableFile, boolean>,
    dirs: dirs as Record<CopyableDir, string[]>,
  };
}

/** Read a profile's profile.json */
export function readProfile(name: string): ProfileConfig | null {
  const path = join(profilePath(name), "profile.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

/** Write profile.json */
function writeProfile(name: string, config: ProfileConfig): void {
  const dir = profilePath(name);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "profile.json"), JSON.stringify(config, null, 2));
}

/** List all profile directories (piw + pi-profile managed), skip hidden */
export function listAllProfileDirs(): string[] {
  ensureProfilesDir();
  if (!existsSync(PROFILES_DIR)) return [];

  return readdirSync(PROFILES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name);
}

/** List piw-managed profiles */
export function listProfiles(): ProfileInfo[] {
  ensureProfilesDir();
  if (!existsSync(PROFILES_DIR)) return [];

  const entries = readdirSync(PROFILES_DIR, { withFileTypes: true });
  const profiles: ProfileInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const cfg = readProfile(entry.name);
    if (!cfg?.files) continue;
    profiles.push({
      name: cfg.name,
      createdAt: cfg.createdAt,
      dir: profilePath(entry.name),
      config: cfg,
    });
  }

  return profiles;
}

/** Create a new profile */
export function createProfile(
  name: string,
  source: string,
  files: Record<CopyableFile, boolean>,
  dirs: Record<CopyableDir, string[]>,
): ProfileConfig {
  ensureProfilesDir();

  const dir = profilePath(name);
  if (existsSync(dir)) throw new Error(`Profile "${name}" already exists`);

  const config: ProfileConfig = {
    name,
    createdAt: new Date().toISOString(),
    source,
    files: { ...files },
    dirs: { ...dirs },
  };

  mkdirSync(dir, { recursive: true });
  writeProfile(name, config);

  // Always-local: sessions, memory, identity files
  mkdirSync(join(dir, "sessions"), { recursive: true });
  mkdirSync(join(dir, "memory"), { recursive: true });
  writeFileSync(join(dir, "AGENTS.md"), "");
  writeFileSync(join(dir, "APPEND_SYSTEM.md"), "");

  // Auth is always symlinked from base
  applyAuth(name);

  // Apply copies
  applyAll(name, source, files, dirs);

  return config;
}

/** Delete a profile */
export function deleteProfile(name: string): void {
  const dir = profilePath(name);
  if (!existsSync(dir)) throw new Error(`Profile "${name}" not found`);
  rmSync(dir, { recursive: true, force: true });
}

/** Rename a profile */
export function renameProfile(oldName: string, newName: string): void {
  const oldDir = profilePath(oldName);
  const newDir = profilePath(newName);
  if (!existsSync(oldDir)) throw new Error(`Profile "${oldName}" not found`);
  if (existsSync(newDir))
    throw new Error(`Profile "${newName}" already exists`);

  renameSync(oldDir, newDir);

  const cfg = readProfile(newName);
  if (cfg) {
    cfg.name = newName;
    writeProfile(newName, cfg);
  }
}

/** Update config and re-apply all copies */
export function updateConfig(
  name: string,
  source: string,
  files: Record<CopyableFile, boolean>,
  dirs: Record<CopyableDir, string[]>,
): void {
  const cfg = readProfile(name);
  if (!cfg) throw new Error(`Profile "${name}" not found`);

  cfg.source = source;
  cfg.files = { ...files };
  cfg.dirs = { ...dirs };
  writeProfile(name, cfg);

  applyAuth(name);
  applyAll(name, source, files, dirs);
}

/** Apply all copies for a profile */
function applyAll(
  name: string,
  source: string,
  files: Record<CopyableFile, boolean>,
  dirs: Record<CopyableDir, string[]>,
): void {
  for (const f of COPYABLE_FILES) {
    applyCopy(name, source, f, files[f] ? undefined : null);
  }
  for (const d of COPYABLE_DIRS) {
    applyCopy(name, source, d, dirs[d]);
  }
}
