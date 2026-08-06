import { cancel, intro, isCancel, select } from "@clack/prompts";
import { clone } from "./commands/clone.js";
import { spawn } from "./spawn.js";
import { create } from "./commands/create.js";
import { deleteCmd } from "./commands/delete.js";
import { install } from "./commands/install.js";
import { update } from "./commands/update.js";
import { manage } from "./commands/manage.js";
import { listAllProfileDirs, profilePath } from "./services/profile.service.js";

const MODES = [
  {
    value: "create",
    label: "Create",
    hint: "Create a new profile",
    fn: create,
  },
  {
    value: "clone",
    label: "Clone",
    hint: "Clone a profile with all resources",
    fn: clone,
  },
  {
    value: "manage",
    label: "Manage",
    hint: "Show/copy/delete resources, rename, delete profile",
    fn: manage,
  },
  {
    value: "install",
    label: "Install",
    hint: "Install a package into profiles",
    fn: install,
  },
  {
    value: "update",
    label: "Update extensions",
    hint: "Bulk update pi extensions in profiles",
    fn: update,
  },
];

export default async function interactive(): Promise<void> {
  intro("piw — Pi Profile Manager");

  const profiles = listAllProfileDirs();

  const options: Array<{ value: string; label: string; hint?: string }> = [];

  if (profiles.length > 0) {
    options.push({
      value: "_run",
      label: "Run",
      hint: `Launch pi with a profile (${profiles.length} available)`,
    });
  }

  for (const m of MODES) {
    options.push(m);
  }

  const mode = await select({
    message: "What would you like to do?",
    options,
  });

  if (isCancel(mode)) {
    cancel("Goodbye");
    return;
  }

  if (mode === "_run") {
    const target = await select({
      message: "Select profile to launch:",
      options: profiles.map((name) => ({ value: name, label: name })),
    });

    if (isCancel(target)) {
      cancel("Cancelled");
      return;
    }

    const dir = profilePath(target);
    const { composeForLaunch } = await import("./services/inherit.service.js");
    composeForLaunch(target);
    console.log(`Launching pi with profile "${target}"...`);
    const proc = spawn(["pi"], {
      env: { ...process.env, PI_CODING_AGENT_DIR: dir },
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    process.exit(await proc.exited);
  }

  const entry = MODES.find((m) => m.value === mode);
  if (entry) await entry.fn();
}
