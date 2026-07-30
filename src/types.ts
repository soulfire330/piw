// Resources that can be inherited from base Pi (~/.pi/agent/)
export const INHERITABLE_FILES = [
  "auth.json",
  "models.json",
  "settings.json",
  "keybindings.json",
] as const;

export const INHERITABLE_DIRS = [
  "extensions",
  "skills",
  "prompts",
  "themes",
] as const;

export type InheritableFile = (typeof INHERITABLE_FILES)[number];
export type InheritableDir = (typeof INHERITABLE_DIRS)[number];
export type InheritableKey = InheritableFile | InheritableDir;

// Maps a key to its display label
export const INHERIT_LABELS: Record<InheritableKey, string> = {
  "auth.json": "auth.json — credentials",
  "models.json": "models.json — custom models",
  "settings.json": "settings.json — settings",
  "keybindings.json": "keybindings.json — keybindings",
  extensions: "extensions/ — extensions",
  skills: "skills/ — skills",
  prompts: "prompts/ — prompts",
  themes: "themes/ — themes",
};

// Per-resource inheritance entry.
// null → "none" (empty placeholder, don't copy or link anything)
export interface InheritEntry {
  source: "base" | string; // "base" or a profile name
  action: "copy" | "inherit";
  /** For directories: only apply these items. Undefined = all. */
  items?: string[];
}

// Per-profile metadata stored in ~/.pi/profiles/<name>/profile.json
export interface ProfileConfig {
  name: string;
  createdAt: string; // ISO date
  inherits: Record<InheritableKey, InheritEntry | null>;
}

export interface ProfileInfo {
  name: string;
  createdAt: string;
  dir: string;
  inherits: Record<InheritableKey, InheritEntry | null>;
}
