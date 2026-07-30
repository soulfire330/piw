import { cancel, intro, isCancel, select } from "@clack/prompts";
import { create } from "./commands/create.js";
import { delete_ } from "./commands/delete.js";
import { install } from "./commands/install.js";
import { list } from "./commands/list.js";
import { rename } from "./commands/rename.js";
import { sync } from "./commands/sync.js";
import { listAllProfileDirs } from "./utils/profile.js";
import { profilePath } from "./utils/symlinks.js";

const MODES: Record<
  string,
  { label: string; hint: string; fn: () => Promise<void> }
> = {
  create: {
    label: "Create",
    hint: "Create a new profile",
    fn: create,
  },
  list: {
    label: "List",
    hint: "Show all profiles",
    fn: list,
  },
  install: {
    label: "Install",
    hint: "Install a package into a profile",
    fn: install,
  },
  delete: { label: "Delete", hint: "Remove a profile", fn: delete_ },
  rename: { label: "Rename", hint: "Rename an existing profile", fn: rename },
  sync: {
    label: "Sync",
    hint: "Edit which resources are copied from base",
    fn: sync,
  },
};

async function interactive(): Promise<void> {
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

  for (const [value, { label, hint }] of Object.entries(MODES)) {
    if (value === "list") continue;
    options.push({ value, label, hint });
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
    console.log(`Launching pi with profile "${target}"...`);
    const proc = Bun.spawn(["pi"], {
      env: { ...process.env, PI_CODING_AGENT_DIR: dir },
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    process.exit(await proc.exited);
  }

  const entry = MODES[mode];
  if (entry) await entry.fn();
}

async function main(): Promise<void> {
  const cmd = process.argv[2];

  if (cmd && MODES[cmd]) {
    await MODES[cmd].fn();
    return;
  }

  if (cmd) {
    const profiles = listAllProfileDirs();
    if (profiles.includes(cmd)) {
      const dir = profilePath(cmd);
      console.log(`Launching pi with profile "${cmd}"...`);
      const proc = Bun.spawn(["pi", ...process.argv.slice(3)], {
        env: { ...process.env, PI_CODING_AGENT_DIR: dir },
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      process.exit(await proc.exited);
    }
  }

  if (cmd === "--help" || cmd === "-h") {
    console.log("piw — Interactive Pi Profile Manager");
    console.log("");
    console.log("Usage:");
    console.log("  piw                Interactive mode");
    console.log("  piw create         Create a profile");
    console.log("  piw list           List profiles");
    console.log("  piw delete         Delete a profile");
    console.log("  piw rename         Rename a profile");
    console.log("  piw sync           Edit copies from base");
    console.log("  piw install <pkg>  Install a package into a profile");
    console.log("  piw <profile>       Launch pi with a specific profile");
    return;
  }

  await interactive();
}

await main();
