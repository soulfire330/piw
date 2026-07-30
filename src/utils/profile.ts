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
  InheritableKey,
  InheritEntry,
  ProfileConfig,
  ProfileInfo,
} from "../types.js";
import { INHERITABLE_DIRS, INHERITABLE_FILES } from "../types.js";
import { applyInheritEntry, profilePath } from "./symlinks.js";

const PROFILES_DIR = `${process.env.HOME}/.pi/profiles`;

/** Ensure the profiles root directory exists */
export function ensureProfilesDir(): void {
  if (!existsSync(PROFILES_DIR)) {
    mkdirSync(PROFILES_DIR, { recursive: true });
  }
}

/** Default inheritance: everything inherited from base via symlink */
export function defaultInherits(): Record<InheritableKey, InheritEntry> {
  const defaults: Record<string, InheritEntry> = {};
  const base: InheritEntry = { source: "base", action: "inherit" };
  for (const f of INHERITABLE_FILES) defaults[f] = base;
  for (const d of INHERITABLE_DIRS) defaults[d] = base;
  return defaults as Record<InheritableKey, InheritEntry>;
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
export function writeProfile(name: string, config: ProfileConfig): void {
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
    if (!cfg?.inherits) continue;
    profiles.push({
      name: cfg.name,
      createdAt: cfg.createdAt,
      dir: profilePath(entry.name),
      inherits: cfg.inherits,
    });
  }

  return profiles;
}

/** Create a new profile */
export function createProfile(
  name: string,
  inherits: Record<InheritableKey, InheritEntry | null>,
): ProfileConfig {
  ensureProfilesDir();

  const dir = profilePath(name);
  if (existsSync(dir)) throw new Error(`Profile "${name}" already exists`);

  const config: ProfileConfig = {
    name,
    createdAt: new Date().toISOString(),
    inherits,
  };

  mkdirSync(dir, { recursive: true });
  writeProfile(name, config);

  // Always-local: sessions, memory, identity files
  mkdirSync(join(dir, "sessions"), { recursive: true });
  mkdirSync(join(dir, "memory"), { recursive: true });
  writeFileSync(join(dir, "AGENTS.md"), "");
  writeFileSync(join(dir, "APPEND_SYSTEM.md"), "");

  // Apply inheritance
  for (const key of [
    ...INHERITABLE_FILES,
    ...INHERITABLE_DIRS,
  ] as InheritableKey[]) {
    applyInheritEntry(name, key, inherits[key] ?? null);
  }

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

/** Update inheritance for a profile: apply new entries, diffing against old */
export function updateInherits(
  name: string,
  inherits: Record<InheritableKey, InheritEntry | null>,
): void {
  const cfg = readProfile(name);
  if (!cfg) throw new Error(`Profile "${name}" not found`);

  cfg.inherits = { ...inherits };
  writeProfile(name, cfg);

  for (const key of [
    ...INHERITABLE_FILES,
    ...INHERITABLE_DIRS,
  ] as InheritableKey[]) {
    applyInheritEntry(name, key, inherits[key] ?? null);
  }
}
