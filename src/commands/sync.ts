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

/** Human-readable label for an InheritEntry */
function entryLabel(entry: InheritEntry | null): string {
  if (entry === null) return "None";
  const src = entry.source === "base" ? "Base" : entry.source;
  const act = entry.action === "inherit" ? "→ Inherit" : "→ Copy";
  return `${src} ${act}`;
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
    options: profiles.map((p) => ({
      value: p.name,
      label: p.name,
    })),
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

  const dirs = listAllProfileDirs();
  const changes: string[] = [];
  const newInherits: Record<InheritableKey, InheritEntry | null> = {
    ...cfg.inherits,
  };

  for (const key of ALL_KEYS) {
    const current = newInherits[key] ?? null;
    const currentLabel = entryLabel(current);

    const choice = await select({
      message: `${INHERIT_LABELS[key]}`,
      options: [
        {
          value: "keep",
          label: `Keep current (${currentLabel})`,
        },
        {
          value: "base:inherit",
          label: "Base → Inherit (symlink)",
        },
        {
          value: "base:copy",
          label: "Base → Copy",
        },
        ...dirs
          .filter((d) => d !== target)
          .flatMap((d) => [
            { value: `${d}:inherit`, label: `${d} → Inherit (symlink)` },
            { value: `${d}:copy`, label: `${d} → Copy` },
          ]),
        {
          value: "none",
          label: "None (empty placeholder)",
        },
      ],
    });

    if (isCancel(choice)) {
      cancel("Cancelled");
      return;
    }

    if (choice === "keep") continue;

    const prev = currentLabel;
    newInherits[key] =
      choice === "none"
        ? null
        : {
            source: choice.slice(0, choice.lastIndexOf(":")),
            action: choice.slice(choice.lastIndexOf(":") + 1) as
              | "copy"
              | "inherit",
          };
    changes.push(
      `${INHERIT_LABELS[key]}: ${prev} → ${entryLabel(newInherits[key])}`,
    );
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
