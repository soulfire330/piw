// Config files that can be copied from base Pi (~/.pi/agent/).
// auth.json is always symlinked — not listed here.
export const COPYABLE_FILES = [
  "models.json",
  "settings.json",
  "keybindings.json",
] as const;

export const COPYABLE_DIRS = [
  "extensions",
  "skills",
  "prompts",
  "themes",
] as const;

export type CopyableFile = (typeof COPYABLE_FILES)[number];
export type CopyableDir = (typeof COPYABLE_DIRS)[number];

export const COPYABLE_LABELS: Record<CopyableFile | CopyableDir, string> = {
  "models.json": "models.json — custom models",
  "settings.json": "settings.json — settings",
  "keybindings.json": "keybindings.json — keybindings",
  extensions: "extensions/ — extensions",
  skills: "skills/ — skills",
  prompts: "prompts/ — prompts",
  themes: "themes/ — themes",
};

// Per-profile metadata stored in ~/.pi/profiles/<name>/profile.json
export interface ProfileConfig {
  name: string;
  createdAt: string; // ISO date
  /** Where to copy from: "base" or a profile name */
  source: string;
  /** Files to copy (false = skip) */
  files: Record<CopyableFile, boolean>;
  /** Directory items to copy (empty = none) */
  dirs: Record<CopyableDir, string[]>;
}

export interface ProfileInfo {
  name: string;
  createdAt: string;
  dir: string;
  config: ProfileConfig;
}
