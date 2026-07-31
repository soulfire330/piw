import {
  cancel,
  confirm,
  groupMultiselect,
  intro,
  isCancel,
  log,
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

  // Build package-provided items set to filter out from loose selection
  const pkgProvided: Record<CopyableDir, Set<string>> = {
    extensions: getPackageProvidedItems(srcDir, "extensions"),
    skills: getPackageProvidedItems(srcDir, "skills"),
    prompts: getPackageProvidedItems(srcDir, "prompts"),
    themes: getPackageProvidedItems(srcDir, "themes"),
  };

  const groups: Record<string, Array<{ value: string; label: string; hint?: string }>> = {};

  // ── Packages group ──
  const srcPackages = readPackagesFromDir(srcDir);
  if (srcPackages.length > 0) {
    groups["Packages"] = srcPackages.map((p) => ({
      value: `pkg:${p.source}`,
      label: p.source,
      hint: "pi install",
    }));
  }

  // ── Config files group ──
  const configFiles = ["models.json", "keybindings.json"];
  groups["Config files"] = configFiles.map((f) => ({
    value: `config:${f}`,
    label: f,
    hint: `${source}/`,
  }));

  // ── Loose resource groups ──
  for (const d of COPYABLE_DIRS) {
    const allItems = listSourceItems(source, d);
    const looseItems = allItems.filter((item) => !pkgProvided[d].has(item));
    if (looseItems.length > 0) {
      groups[COPYABLE_LABELS[d]] = looseItems.map((item) => ({
        value: `loose:${d}:${item}`,
        label: item,
        hint: `${d}/`,
      }));
    }
  }

  const groupNames = Object.keys(groups);
  if (groupNames.length === 0) {
    log.info("Nothing to copy from source");
    const proceed = await confirm({
      message: `Create empty profile "${name}"?`,
      active: "Create",
      inactive: "Cancel",
    });
    if (isCancel(proceed) || !proceed) {
      cancel("Cancelled");
      return;
    }
    createProfile(name);
    log.success(`Launch with: piw ${name}`);
    outro("Done");
    return;
  }

  const picked = await groupMultiselect({
    message: `Inherit from ${srcLabel}?`,
    options: groups,
    groupSpacing: 1,
    selectableGroups: false,
    required: false,
  });

  if (isCancel(picked)) {
    cancel("Cancelled");
    return;
  }

  const selected = (picked as string[]) ?? [];
  const inheritedPackages: string[] = [];
  const configsToCopy: string[] = [];
  const dirItems: Record<string, string[]> = {};

  for (const v of selected) {
    if (v.startsWith("pkg:")) {
      inheritedPackages.push(v.slice(4));
    } else if (v.startsWith("config:")) {
      configsToCopy.push(v.slice(7));
    } else if (v.startsWith("loose:")) {
      const colon1 = v.indexOf(":");
      const colon2 = v.indexOf(":", colon1 + 1);
      const d = v.slice(colon1 + 1, colon2);
      const item = v.slice(colon2 + 1);
      if (!dirItems[d]) dirItems[d] = [];
      dirItems[d]!.push(item);
    }
  }

  if (inheritedPackages.length === 0 && configsToCopy.length === 0 && Object.keys(dirItems).length === 0) {
    log.info("Nothing selected");
    outro("Cancelled");
    return;
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

        for (const d of Object.keys(dirItems)) {
          const items = dirItems[d] ?? [];
          if (items.length > 0) {
            copyLooseDirItems(name, source, d as CopyableDir, items);
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
