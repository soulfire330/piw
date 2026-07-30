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
    hint: "Create a new profile with custom inheritance",
    fn: create,
  },
  list: {
    label: "List",
    hint: "Show all profiles and their inheritance status",
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
    hint: "Toggle which resources are inherited via symlinks",
    fn: sync,
  },
};

async function interactive(): Promise<void> {
  intro("piw — Pi Profile Manager");

  const profiles = listAllProfileDirs();

  // Build menu: Run first if profiles exist, then the rest
  const options: Array<{ value: string; label: string; hint?: string }> = [];

  if (profiles.length > 0) {
    options.push({
      value: "_run",
      label: "Run",
      hint: `Launch pi with a profile (${profiles.length} available)`,
    });
  }

  for (const [value, { label, hint }] of Object.entries(MODES)) {
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

  // Run: pick a profile and launch pi
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

  // If the argument matches a profile name, launch pi in that profile
  if (cmd) {
    const profiles = listAllProfileDirs();
    const match = profiles.find((p) => p === cmd);
    if (match) {
      const dir = profilePath(match.name);
      console.log(`Launching pi with profile "${match.name}"...`);
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
    console.log("  piw sync           Toggle inheritance");
    console.log("  piw install <pkg>  Install a package into a profile");
    console.log("  piw <profile>       Launch pi with a specific profile");
    return;
  }

  await interactive();
}

await main();
