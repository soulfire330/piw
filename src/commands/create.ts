import { existsSync } from "node:fs";
import type { CreateOptions, CopyableDir } from "../types.js";
import { COPYABLE_DIRS, COPYABLE_LABELS } from "../types.js";
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
import { composeProfile, writeExtends } from "../services/inherit.service.js";

function sourceDir(src: string): string {
  return src === "_root_" ? basePath() : `${process.env.HOME}/.pi/profiles/${src}`;
}

export async function create(opts?: CreateOptions): Promise<void> {
  const o = opts ?? {};

  // ── Non-interactive path: --name + (--from | --empty | --extends) ──
  // Two independent ways to seed a new profile, and you can combine them:
  //   --from   : one-time COPY of resources from a source (copy-on-write).
  //   --extends: a LIVING link — the profile is (re)built from the union of the
  //              listed parent profiles on every launch. See inherit.service.ts.
  const hasExtends = !!o.extends && o.extends.length > 0;
  if (o.name && (o.from || o.empty || hasExtends)) {
    const name = o.name;
    const err = validateProfileName(name);
    if (err) {
      console.error(`Invalid profile name: ${err}`);
      process.exit(1);
    }

    createProfile(name);

    const summary: string[] = [];

    // Copy from a source profile / _root_ (copy-on-write, optional)
    if (o.from) {
      const source = o.from;
      const srcDir = sourceDir(source);

      // Packages
      const srcPackages = readPackagesFromDir(srcDir);
      const selectedPkgs = o.packages
        ? srcPackages.filter((p) => o.packages!.includes(p.source)).map((p) => p.source)
        : srcPackages.map((p) => p.source);

      if (selectedPkgs.length > 0) {
        copySettingsWithPackages(name, source, selectedPkgs);
      }

      // Config files
      const configs = o.configs ?? ["models.json", "keybindings.json"];
      for (const f of configs) {
        copyConfigFile(name, source, f);
      }

      // Loose resources — if specific items given, copy those; otherwise copy all
      const resourceFilters: Record<string, string[] | undefined> = {
        extensions: o.extensions,
        skills: o.skills,
        prompts: o.prompts,
        themes: o.themes,
      };

      let totalLoose = 0;
      for (const d of COPYABLE_DIRS) {
        const filter = resourceFilters[d];
        const srcItems = listSourceItems(source, d);
        const pkgProvided = getPackageProvidedItems(srcDir, d);
        const looseItems = srcItems.filter((item) => !pkgProvided.has(item));
        const toCopy = filter
          ? looseItems.filter((i) => filter.includes(i))
          : looseItems;
        if (toCopy.length > 0) {
          copyLooseDirItems(name, source, d, toCopy);
          totalLoose += toCopy.length;
        }
      }

      const parts: string[] = [];
      if (selectedPkgs.length > 0) parts.push(`${selectedPkgs.length} package(s)`);
      if (configs.length > 0) parts.push(`${configs.length} config(s)`);
      if (totalLoose > 0) parts.push(`${totalLoose} loose resource(s)`);
      summary.push(`from ${source} (${parts.join(", ") || "copy all"})`);
      if (selectedPkgs.length > 0) {
        console.log(`${selectedPkgs.length} package(s) declared — Pi will install them on first launch`);
      }
    }

    // Inheritance — record the parents in settings.json, then compose the union
    // now so the profile is usable immediately (it is re-composed on each launch).
    // Parent names are already validated at the CLI boundary (index.ts checkName).
    if (hasExtends) {
      writeExtends(name, o.extends!);
      const res = composeProfile(name);
      for (const m of res.missing)
        console.warn(`⚠ Parent profile "${m}" not found — skipped`);
      if (res.cycle)
        console.warn(`⚠ Inheritance cycle detected — offending parents skipped`);
      summary.push(`extends ${o.extends!.join(", ")}`);
    }

    if (summary.length === 0) {
      console.log(`Empty profile "${name}" created at ~/.pi/profiles/${name}/`);
    } else {
      console.log(`Profile "${name}" created — ${summary.join("; ")}`);
    }
    console.log(`Launch with: piw ${name}`);
    return;
  }

  // ── Interactive path ─────────────────────────────────────────
  const {
    cancel,
    confirm,
    groupMultiselect,
    intro,
    isCancel,
    log,
    multiselect,
    outro,
    select,
    tasks,
    text,
  } = await import("@clack/prompts");

  intro("piw — Create Profile");

  const name = o.name ?? (await text({
    message: "Profile name:",
    placeholder: "my-agent",
    validate: (v) => validateProfileName(v as string),
  }));

  if (isCancel(name)) {
    cancel("Cancelled");
    return;
  }

  const profiles = listAllProfileDirs();

  const home = process.env.HOME ?? "~";

  // Inheritance — pick which profiles to inherit from. It's all-or-nothing: each
  // selected profile is inherited IN FULL (you don't choose individual items),
  // and its resources are composed in on every launch. Separate from the
  // one-time "Copy from" step below. (--extends on the CLI skips this prompt.)
  let extendsSel: string[] = o.extends ?? [];
  if (!o.extends && (profiles.length > 0 || existsSync(basePath()))) {
    const picked = await multiselect({
      message: "Inherit from? (inherits everything — Enter to skip)",
      options: [
        { value: "_root_", label: "_root_", hint: "base pi dir" },
        ...profiles.map((p) => ({ value: p, label: p })),
      ],
      required: false,
    });
    if (isCancel(picked)) {
      cancel("Cancelled");
      return;
    }
    extendsSel = (picked as string[]) ?? [];
  }

  // Saves the chosen parents and composes their union into the new profile.
  // Invoked right after createProfile() in each of the creation branches below,
  // so it works whether the profile is empty, copied from a source, or neither.
  const applyExtends = (): void => {
    if (extendsSel.length === 0) return;
    writeExtends(name as string, extendsSel);
    const res = composeProfile(name as string);
    for (const m of res.missing)
      log.warn(`Parent profile "${m}" not found — skipped`);
    if (res.cycle) log.warn("Inheritance cycle detected — offending parents skipped");
  };
  const sourceOptions: Array<{ value: string; label: string; hint?: string }> = [
    { value: "_root_", label: "_root_", hint: `${home}/.pi/agent/` },
    ...profiles.map((p) => ({
      value: p,
      label: p,
      hint: `${home}/.pi/profiles/${p}/`,
    })),
    { value: "none", label: "None", hint: "empty profile" },
  ];

  const src = o.from ?? (await select({
    message: "Copy from?",
    options: sourceOptions,
  }));

  if (isCancel(src)) {
    cancel("Cancelled");
    return;
  }

  const source = src as string;

  if (source === "none") {
    const proceed = o.yes ? true : await confirm({
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
          applyExtends();
          return extendsSel.length > 0
            ? `Profile "${name}" created — extends ${extendsSel.join(", ")}`
            : `Empty profile "${name}" created at ~/.pi/profiles/${name}/`;
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
    const proceed = o.yes ? true : await confirm({
      message: `Create empty profile "${name}"?`,
      active: "Create",
      inactive: "Cancel",
    });
    if (isCancel(proceed) || !proceed) {
      cancel("Cancelled");
      return;
    }
    createProfile(name);
    applyExtends();
    log.success(`Launch with: piw ${name}`);
    outro("Done");
    return;
  }

  const picked = await groupMultiselect({
    message: `Copy from ${srcLabel}?`,
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

  if (
    inheritedPackages.length === 0 &&
    configsToCopy.length === 0 &&
    Object.keys(dirItems).length === 0 &&
    extendsSel.length === 0
  ) {
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
  if (extendsSel.length > 0) parts.push(`extends ${extendsSel.join(", ")}`);

  const proceed = o.yes ? true : await confirm({
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

        // Compose inheritance on top — copied source items count as "own".
        applyExtends();

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
