import {
  cancel,
  intro,
  isCancel,
  log,
  outro,
  select,
  tasks,
} from "@clack/prompts";
import type { InheritableKey, InheritEntry } from "../types.js";
import {
  INHERIT_LABELS,
  INHERITABLE_DIRS,
  INHERITABLE_FILES,
} from "../types.js";
import {
  listAllProfileDirs,
  listProfiles,
  readProfile,
  updateInherits,
} from "../utils/profile.js";

function entryLabel(entry: InheritEntry | null): string {
  if (entry === null) return "None";
  const src = entry.source === "base" ? "Base" : entry.source;
  const act = entry.action === "inherit" ? "symlink" : "copy";
  return `${src}/${act}`;
}

const ALL_KEYS: InheritableKey[] = [
  ...INHERITABLE_FILES,
  ...INHERITABLE_DIRS,
] as InheritableKey[];

export async function sync(): Promise<void> {
  intro("piw — Edit Inheritance");

  const profiles = listProfiles();

  if (profiles.length === 0) {
    log.warn(
      "No piw-managed profiles found. Create one first, or use 'piw adopt' to convert an existing profile.",
    );
    outro("Done");
    return;
  }

  const target = await select({
    message: "Select profile to manage:",
    options: profiles.map((p) => ({ value: p.name, label: p.name })),
  });

  if (isCancel(target)) {
    cancel("Cancelled");
    return;
  }

  const cfg = readProfile(target);

  if (!cfg) {
    log.error(`Profile "${target}" not found`);
    outro("Done");
    return;
  }

  const dirs = listAllProfileDirs().filter((d) => d !== target);
  const changes: string[] = [];
  const newInherits: Record<InheritableKey, InheritEntry | null> = {
    ...cfg.inherits,
  };

  for (const key of ALL_KEYS) {
    const current = newInherits[key] ?? null;
    const currentLabel = entryLabel(current);

    const source = await select({
      message: `${INHERIT_LABELS[key]} — currently ${currentLabel}`,
      options: [
        { value: "keep", label: `Keep current (${currentLabel})` },
        { value: "base", label: "Base (~/.pi/agent/)" },
        ...dirs.map((d) => ({ value: d, label: d })),
        { value: "none", label: "None" },
      ],
    });

    if (isCancel(source)) {
      cancel("Cancelled");
      return;
    }

    if (source === "keep") continue;
    if (source === "none") {
      changes.push(`${INHERIT_LABELS[key]}: ${currentLabel} → None`);
      newInherits[key] = null;
      continue;
    }

    const action = await select({
      message: `${INHERIT_LABELS[key]} — how?`,
      options: [
        { value: "inherit", label: "Inherit (symlink)" },
        { value: "copy", label: "Copy" },
      ],
    });

    if (isCancel(action)) {
      cancel("Cancelled");
      return;
    }

    const entry: InheritEntry = {
      source: source as string,
      action: action as "copy" | "inherit",
    };
    changes.push(
      `${INHERIT_LABELS[key]}: ${currentLabel} → ${entryLabel(entry)}`,
    );
    newInherits[key] = entry;
  }

  if (changes.length === 0) {
    log.info("No changes");
    outro("Done");
    return;
  }

  log.info(`Changes:\n${changes.map((c) => `  ${c}`).join("\n")}`);

  await tasks([
    {
      title: "Updating inheritance",
      task: async () => {
        updateInherits(target, newInherits);
        return `${changes.length} resource(s) updated`;
      },
    },
  ]);

  log.success(`Profile "${target}" updated`);
  outro("Done");
}
