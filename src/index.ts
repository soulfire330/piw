import { cancel, intro, isCancel, select } from "@clack/prompts";
import { clone } from "./commands/clone.js";
import { create } from "./commands/create.js";
import { deleteCmd } from "./commands/delete.js";
import { install } from "./commands/install.js";
import { list } from "./commands/list.js";
import { manage } from "./commands/manage.js";
import { rename } from "./commands/rename.js";
import { show } from "./commands/show.js";
import { listAllProfileDirs, profilePath } from "./services/profile.service.js";

const MODES: Record<
  string,
  { label: string; hint: string; fn: (...args: string[]) => Promise<void> }
> = {
  create: { label: "Create", hint: "Create a new profile", fn: create },
  list: { label: "List", hint: "Show all profiles", fn: list },
  show: { label: "Show", hint: "Show profile details", fn: show },
  clone: {
    label: "Clone",
    hint: "Clone a profile with all resources",
    fn: clone,
  },
  manage: {
    label: "Manage",
    hint: "Packages, resources, rename, delete",
    fn: manage,
  },
  install: {
    label: "Install",
    hint: "Install a package into profiles",
    fn: install,
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

  if (cmd === "--help" || cmd === "-h") {
    console.log("piw — Pi Profile Manager");
    console.log("");
    console.log("Usage:");
    console.log("  piw                      Interactive mode");
    console.log("  piw create               Create a profile");
    console.log("  piw list                 List profiles");
    console.log("  piw show [name]          Show profile details");
    console.log("  piw clone [src] [dst]    Clone a profile");
    console.log("  piw rename <old> [new]   Rename a profile");
    console.log("  piw delete [name]        Delete a profile");
    console.log("  piw manage               Manage packages & resources");
    console.log("  piw install <pkg>        Install a package into profiles");
    console.log("  piw <profile>            Launch pi with a specific profile");
    return;
  }

  if (cmd === "create") {
    await create();
    return;
  }

  if (cmd === "list") {
    await list();
    return;
  }

  if (cmd === "show") {
    await show(process.argv[3]);
    return;
  }

  if (cmd === "clone") {
    await clone(process.argv[3], process.argv[4]);
    return;
  }

  if (cmd === "rename") {
    await rename(process.argv[3], process.argv[4]);
    return;
  }

  if (cmd === "delete") {
    await deleteCmd(process.argv[3]);
    return;
  }

  if (cmd === "manage") {
    await manage();
    return;
  }

  if (cmd === "install") {
    await install();
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

  await interactive();
}

await main();
