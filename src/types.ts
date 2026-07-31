// Directories that contain resources (from packages or loose).
export const COPYABLE_DIRS = ["extensions", "skills", "prompts", "themes"] as const;
export type CopyableDir = (typeof COPYABLE_DIRS)[number];

export const COPYABLE_LABELS: Record<CopyableDir, string> = {
  extensions: "Extensions",
  skills: "Skills",
  prompts: "Prompts",
  themes: "Themes",
};

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

// ── CLI options (non-interactive) ─────────────────────────────

export interface CreateOptions {
  name?: string;
  from?: string;
  empty?: boolean;
  packages?: string[];
  configs?: string[];
  extensions?: string[];
  skills?: string[];
  prompts?: string[];
  themes?: string[];
  yes?: boolean;
}

export interface CloneOptions {
  source?: string;
  target?: string;
  yes?: boolean;
}

export interface DeleteOptions {
  name?: string;
  yes?: boolean;
}

export interface InstallOptions {
  pkg?: string;
  targets?: string[];
}

export interface ManageOptions {
  profile?: string;
  show?: boolean;
  copyFrom?: string;
  renameTo?: string;
  deleteProfile?: boolean;
  yes?: boolean;
}

export interface ListOptions {
  json?: boolean;
}

export interface ShowOptions {
  name?: string;
  json?: boolean;
}
