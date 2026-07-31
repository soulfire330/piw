import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  multiselect,
  outro,
  select,
  tasks,
  text,
} from "@clack/prompts";
import { COPYABLE_DIRS, COPYABLE_LABELS, type CopyableDir } from "../types.js";
import {
  readPackagesFromDir,
  getPackageProvidedItems,
} from "../services/package.service.js";
import {
  listAllProfileDirs,
  createProfile,
  validateProfileName,
  basePath,
} from "../services/profile.service.js";
import {
  copyConfigFile,
  copyLooseDirItems,
  copySettingsWithPackages,
  listSourceItems,
} from "../services/resource.service.js";

function sourceDir(src: string): string {
  return src === "_root_" ? basePath() : `${process.env.HOME}/.pi/profiles/${src}`;
}

export async function create(): Promise<void> {
  intro("piw — Create Profile");

  const name = await text({
    message: "Profile name:",
    placeholder: "my-agent",
    validate: (v) => validateProfileName(v as string),
  });

  if (isCancel(name)) {
    cancel("Cancelled");
    return;
  }

  const profiles = listAllProfileDirs();

  const home = process.env.HOME ?? "~";
  const sourceOptions: Array<{ value: string; label: string; hint?: string }> = [
    { value: "_root_", label: "_root_", hint: `${home}/.pi/agent/` },
    ...profiles.map((p) => ({
      value: p,
      label: p,
      hint: `${home}/.pi/profiles/${p}/`,
    })),
    { value: "none", label: "None", hint: "empty profile" },
  ];

  const src = await select({
    message: "Copy from?",
    options: sourceOptions,
  });

  if (isCancel(src)) {
    cancel("Cancelled");
    return;
  }

  const source = src as string;

  if (source === "none") {
    const proceed = await confirm({
      message: `Create empty profile "${name}"?`,
      active: "Create",
      inactive: "Cancel",
    });

    if (isCancel(proceed) || !proceed) {
      cancel("Cancelled");
      return;
    }

    await tasks([
      {
        title: `Creating profile "${name}"`,
        task: async () => {
          createProfile(name);
          return `Empty profile "${name}" created at ~/.pi/profiles/${name}/`;
        },
      },
    ]);

    log.success(`Launch with: piw ${name}`);
    outro("Done");
    return;
  }

  const srcDir = sourceDir(source);
  const srcLabel = source === "_root_" ? "_root_" : source;

  // Step 1: Pick packages
  const srcPackages = readPackagesFromDir(srcDir);
  let inheritedPackages: string[] = [];

  if (srcPackages.length > 0) {
    const picked = await multiselect({
      message: `Inherit packages from ${srcLabel}?`,
      options: srcPackages.map((p) => ({
        value: p.source,
        label: p.source,
      })),
      initialValues: srcPackages.map((p) => p.source),
      required: false,
    });

    if (isCancel(picked)) {
      cancel("Cancelled");
      return;
    }

    inheritedPackages = (picked as string[]) ?? [];
  }

  // Build set of package-provided items to filter out from loose selection
  const pkgProvided: Record<CopyableDir, Set<string>> = {
    extensions: getPackageProvidedItems(srcDir, "extensions"),
    skills: getPackageProvidedItems(srcDir, "skills"),
    prompts: getPackageProvidedItems(srcDir, "prompts"),
    themes: getPackageProvidedItems(srcDir, "themes"),
  };

  // Filter: only include items that are NOT provided by any of the INHERITED packages
  // (we don't filter based on uninherited packages — those are truly "loose" from the new profile's perspective)
  // Actually, we should filter out items that belong to ANY installed package in the source,
  // because the user already decided which packages to inherit — non-inherited packages' items
  // would become "orphaned" (no package to install them).
  // Let's filter: show items NOT provided by any package, plus items from inherited packages
  // But since inherited packages will be auto-installed, we skip those too — they're not "loose"
  // Simple approach: filter out ALL package-provided items, regardless of whether inherited.
  // The user already had a chance to pick packages — those will be auto-installed.

  // Step 2: Pick other config files (models.json, keybindings.json)
  const configFiles = ["models.json", "keybindings.json"];
  const selectedConfig = await multiselect({
    message: `Copy other config files from ${srcLabel}?`,
    options: configFiles.map((f) => ({ value: f, label: f })),
    required: false,
  });

  if (isCancel(selectedConfig)) {
    cancel("Cancelled");
    return;
  }

  const configsToCopy = (selectedConfig as string[]) ?? [];

  // Step 3: Pick loose resources
  const selectedDirs = await multiselect({
    message: `Copy loose resources from ${srcLabel}?`,
    options: COPYABLE_DIRS.map((d) => ({
      value: d,
      label: COPYABLE_LABELS[d],
      hint:
        pkgProvided[d].size > 0
          ? `${pkgProvided[d].size} are package-managed (will be auto-installed if package inherited)`
          : undefined,
    })),
    required: false,
  });

  if (isCancel(selectedDirs)) {
    cancel("Cancelled");
    return;
  }

  const dirs = (selectedDirs as CopyableDir[]) ?? [];
  const dirItems: Record<string, string[]> = {};

  for (const d of dirs) {
    const allItems = listSourceItems(source, d);
    // Filter out package-provided items
    const looseItems = allItems.filter((item) => !pkgProvided[d].has(item));
    if (looseItems.length === 0) continue;

    const picked = await multiselect({
      message: `Which loose ${d} to copy?`,
      options: looseItems.map((item) => ({
        value: item,
        label: item,
      })),
      initialValues: looseItems,
      required: false,
    });

    if (isCancel(picked)) {
      cancel("Cancelled");
      return;
    }

    dirItems[d] = (picked as string[]) ?? [];
  }

  // Summary
  const parts: string[] = [];
  if (inheritedPackages.length > 0)
    parts.push(`${inheritedPackages.length} package(s)`);
  if (configsToCopy.length > 0)
    parts.push(`${configsToCopy.length} config(s)`);
  const looseCount = Object.values(dirItems).flat().length;
  if (looseCount > 0) parts.push(`${looseCount} loose resource(s)`);

  const proceed = await confirm({
    message: `Create "${name}" from ${srcLabel}? (${parts.join(", ") || "empty"})`,
    active: "Create",
    inactive: "Cancel",
  });

  if (isCancel(proceed) || !proceed) {
    cancel("Cancelled");
    return;
  }

  await tasks([
    {
      title: `Creating profile "${name}"`,
      task: async () => {
        createProfile(name);

        if (inheritedPackages.length > 0) {
          copySettingsWithPackages(name, source, inheritedPackages);
        }

        for (const f of configsToCopy) {
          copyConfigFile(name, source, f);
        }

        for (const d of dirs) {
          const items = dirItems[d] ?? [];
          if (items.length > 0) {
            copyLooseDirItems(name, source, d, items);
          }
        }

        return `Profile "${name}" created at ~/.pi/profiles/${name}/`;
      },
    },
  ]);

  if (inheritedPackages.length > 0) {
    log.info(
      `${inheritedPackages.length} package(s) declared — Pi will install them on first launch`,
    );
  }
  log.success(`Launch with: piw ${name}`);
  outro("Done");
}
