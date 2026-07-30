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
import type { ProfileConfig, ProfileInfo } from "../types.js";
import {
  INHERITABLE_DIRS,
  INHERITABLE_FILES,
  type InheritableKey,
} from "../types.js";
import { inheritResource, localizeResource, profilePath } from "./symlinks.js";

const PROFILES_DIR = `${process.env.HOME}/.pi/profiles`;

/** Ensure the profiles root directory exists */
export function ensureProfilesDir(): void {
  if (!existsSync(PROFILES_DIR)) {
    mkdirSync(PROFILES_DIR, { recursive: true });
  }
}

/** Default inheritance: everything except identity files */
export function defaultInherits(): Record<InheritableKey, boolean> {
  const defaults: Record<string, boolean> = {};
  for (const f of INHERITABLE_FILES) defaults[f] = true;
  for (const d of INHERITABLE_DIRS) defaults[d] = true;
  return defaults as Record<InheritableKey, boolean>;
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

/** List all profile directories (piw + pi-profile managed) */
export function listAllProfileDirs(): string[] {
  ensureProfilesDir();
  if (!existsSync(PROFILES_DIR)) return [];

  return readdirSync(PROFILES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

/** List piw-managed profiles */
export function listProfiles(): ProfileInfo[] {
  ensureProfilesDir();
  if (!existsSync(PROFILES_DIR)) return [];

  const entries = readdirSync(PROFILES_DIR, { withFileTypes: true });
  const profiles: ProfileInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const cfg = readProfile(entry.name);
    // Skip profiles not managed by piw (no inherits field)
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
  inherits: Record<InheritableKey, boolean>,
): ProfileConfig {
  ensureProfilesDir();

  const dir = profilePath(name);
  if (existsSync(dir)) throw new Error(`Profile "${name}" already exists`);

  const config: ProfileConfig = {
    name,
    createdAt: new Date().toISOString(),
    inherits,
  };

  // Create dir and write profile.json
  mkdirSync(dir, { recursive: true });
  writeProfile(name, config);

  // Create local-only directories
  mkdirSync(join(dir, "sessions"), { recursive: true });
  mkdirSync(join(dir, "memory"), { recursive: true });

  // Create identity files (always local, empty)
  writeFileSync(join(dir, "AGENTS.md"), "");
  writeFileSync(join(dir, "APPEND_SYSTEM.md"), "");

  // Apply inheritance
  for (const key of [
    ...INHERITABLE_FILES,
    ...INHERITABLE_DIRS,
  ] as InheritableKey[]) {
    if (inherits[key]) {
      inheritResource(name, key);
    } else {
      localizeResource(name, key);
    }
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

  // Rename the directory
  renameSync(oldDir, newDir);

  // Update profile.json
  const cfg = readProfile(newName);
  if (cfg) {
    cfg.name = newName;
    writeProfile(newName, cfg);
  }
}

/** Update inheritance for a profile: toggle which resources are symlinked */
export function updateInherits(
  name: string,
  inherits: Record<InheritableKey, boolean>,
): void {
  const cfg = readProfile(name);
  if (!cfg) throw new Error(`Profile "${name}" not found`);

  const oldInherits = { ...cfg.inherits };
  cfg.inherits = { ...inherits };
  writeProfile(name, cfg);

  // Apply changes: for each key that changed, flip the symlink
  for (const key of [
    ...INHERITABLE_FILES,
    ...INHERITABLE_DIRS,
  ] as InheritableKey[]) {
    const was = oldInherits[key];
    const now = inherits[key];
    if (was !== now) {
      if (now) {
        inheritResource(name, key);
      } else {
        localizeResource(name, key);
      }
    }
  }
}
