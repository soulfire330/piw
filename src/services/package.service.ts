import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { PackageInfo, PackageResources } from "../types.js";
import { COPYABLE_DIRS } from "../types.js";
import { profilePath } from "./profile.service.js";

export function readPackages(name: string): PackageInfo[] {
  return readPackagesFromDir(profilePath(name));
}

// ── Settings ───────────────────────────────────────────────────

/** Read packages from a settings.json in any directory */
export function readPackagesFromDir(dir: string): PackageInfo[] {
  const sp = join(dir, "settings.json");
  if (!existsSync(sp)) return [];
  try {
    const cfg = JSON.parse(readFileSync(sp, "utf-8"));
    const raw: unknown[] = cfg.packages ?? [];
    return raw.map((p): PackageInfo => {
      if (typeof p === "string") return parsePackageSource(p);
      if (typeof p === "object" && p !== null && "source" in p) {
        return parsePackageSource((p as { source: string }).source);
      }
      return { source: String(p), kind: "unknown" as const, id: String(p) };
    });
  } catch (err) {
    console.warn(`settings.json parse error in ${dir}:`, (err as Error).message);
    return [];
  }
}

function parsePackageSource(source: string): PackageInfo {
  if (source.startsWith("npm:")) {
    return {
      source,
      kind: "npm",
      id: source.slice(4),
    };
  }
  if (
    source.startsWith("git:") ||
    source.startsWith("https://") ||
    source.startsWith("ssh://") ||
    source.startsWith("git://")
  ) {
    const id = source
      .replace(/^(git:|https:\/\/|ssh:\/\/|git:\/\/)/, "")
      .replace(/@.*$/, "");
    return { source, kind: "git", id };
  }
  return { source, kind: "local", id: source };
}

// ── Package resources ──────────────────────────────────────────

/** List items in a directory, skipping dotfiles */
function listDir(dir: string): string[] {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => !e.name.startsWith("."))
      .map((e) => e.name);
  } catch (err) {
    console.warn(`Failed to list directory ${dir}:`, (err as Error).message);
    return [];
  }
}

/** Scan installed packages in any directory */
export function getPackageResourcesFromDir(dir: string): PackageResources {
  const result: PackageResources = {};

  const scanDir = (base: string, pkg: PackageInfo) => {
    for (const d of COPYABLE_DIRS) {
      const items = listDir(join(base, d));
      if (items.length > 0) {
        const entry = result[pkg.id] ?? {
          extensions: [],
          skills: [],
          prompts: [],
          themes: [],
        };
        (entry as Record<string, string[]>)[d] = items;
        result[pkg.id] = entry;
      }
    }
  };

  // Scan npm packages
  const npmBase = join(dir, "npm", "node_modules");
  if (existsSync(npmBase)) {
    for (const entry of readdirSync(npmBase, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const pkg = parsePackageSource(`npm:${entry.name}`);
      scanDir(join(npmBase, entry.name), pkg);
    }
  }

  // Scan git packages
  const gitBase = join(dir, "git");
  if (existsSync(gitBase)) {
    const scanRepo = (base: string, parentPkg: PackageInfo) => {
      if (existsSync(join(base, "package.json")) || existsSync(join(base, "skills"))) {
        scanDir(base, parentPkg);
        return;
      }
      // Descend one level for github.com/user/ pattern
      for (const entry of readdirSync(base, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
        const subDir = join(base, entry.name);
        if (existsSync(join(subDir, "package.json")) || existsSync(join(subDir, "skills"))) {
          scanDir(subDir, parentPkg);
        }
      }
    };

    for (const host of readdirSync(gitBase, { withFileTypes: true })) {
      if (!host.isDirectory() || host.name.startsWith(".")) continue;
      const hostDir = join(gitBase, host.name);
      for (const repo of readdirSync(hostDir, { withFileTypes: true })) {
        if (!repo.isDirectory() || repo.name.startsWith(".")) continue;
        const repoPath = join(hostDir, repo.name);
        const pkg: PackageInfo = {
          source: `git:${host.name}/${repo.name}`,
          kind: "git",
          id: `${host.name}/${repo.name}`,
        };
        scanRepo(repoPath, pkg);
      }
    }
  }

  return result;
}

/** Get items provided by installed packages in a directory, grouped by package */
export function getPackageProvidedItems(
  dir: string,
  resourceType: "extensions" | "skills" | "prompts" | "themes",
): Set<string> {
  const provided = new Set<string>();

  // Scan convention directories (skills/, extensions/, etc.) inside packages
  const resources = getPackageResourcesFromDir(dir);
  for (const pkgId of Object.keys(resources)) {
    const pkg = resources[pkgId];
    if (!pkg) continue;
    for (const item of (pkg as unknown as Record<string, string[]>)[resourceType] ?? []) {
      provided.add(item);
    }
  }

  // Also add package short names — packages that declare resources via pi.extensions
  // rather than convention directories (e.g. pi-rtk-optimizer declares ./index.ts).
  // Any directory/file in extensions/ matching a package name is package-managed.
  const pkgs = readPackagesFromDir(dir);
  for (const pkg of pkgs) {
    if (pkg.kind === "npm") {
      provided.add(pkg.id);
    }
    if (pkg.kind === "git") {
      provided.add(pkg.id.split("/").pop() ?? "");
    }
  }

  return provided;
}
/** List only loose items in a profile directory */
export function listLooseItems(
  name: string,
  dir: "extensions" | "skills" | "prompts" | "themes",
): string[] {
  const profileDir = join(profilePath(name), dir);
  const all = listDir(profileDir);
  const resources = getPackageResourcesFromDir(profilePath(name));
  const provided = new Set<string>();
  for (const pkgId of Object.keys(resources)) {
    const pkg = resources[pkgId];
    if (!pkg) continue;
    for (const item of (pkg as unknown as Record<string, string[]>)[dir] ?? []) {
      provided.add(item);
    }
  }
  return all.filter((i) => !provided.has(i));
}

/** List only package-provided items, grouped by package */
export function listPackageItems(
  name: string,
  dir: "extensions" | "skills" | "prompts" | "themes",
): Map<string, string[]> {
  const resources = getPackageResourcesFromDir(profilePath(name));
  const map = new Map<string, string[]>();
  for (const pkgId of Object.keys(resources)) {
    const pkg = resources[pkgId];
    if (!pkg) continue;
    const items: string[] =
      (pkg as unknown as Record<string, string[]>)[dir] ?? [];
    if (items.length > 0) map.set(pkgId, items);
  }
  return map;
}
