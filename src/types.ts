// Directories that contain resources (from packages or loose).
export const COPYABLE_DIRS = ["extensions", "skills", "prompts", "themes"] as const;
export type CopyableDir = (typeof COPYABLE_DIRS)[number];

export const COPYABLE_LABELS: Record<CopyableDir, string> = {
  extensions: "extensions/ — extensions",
  skills: "skills/ — skills",
  prompts: "prompts/ — prompts",
  themes: "themes/ — themes",
};

// Config files at profile root.
export const CONFIG_FILES = ["models.json", "settings.json", "keybindings.json"] as const;
export type ConfigFile = (typeof CONFIG_FILES)[number];

export interface PackageInfo {
  source: string; // npm:foo, git:github.com/x/y, /local/path
  kind: "npm" | "git" | "local" | "unknown";
  id: string; // unique identifier for dedup
}

export interface PackageResources {
  [packageId: string]: {
    extensions: string[];
    skills: string[];
    prompts: string[];
    themes: string[];
  };
}
