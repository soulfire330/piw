import { parseArgs } from "node:util";
import { spawn } from "./spawn.js";
import { isSafeProfileName } from "./services/profile.service.js";
import type {
  CreateOptions,
  CloneOptions,
  DeleteOptions,
  InstallOptions,
  ManageOptions,
  ListOptions,
  ShowOptions,
  UpdateOptions,
} from "./types.js";

const HELP = `piw — Pi Profile Manager

Usage:
  piw                              Interactive TUI mode
  piw create [options]             Create a profile
  piw list [options]               List profiles
  piw show [name] [options]        Show profile details
  piw clone <src> <dst> [options]  Clone a profile
  piw rename <old> <new>           Rename a profile
  piw delete <name> [options]      Delete a profile
  piw manage <name> [options]      Manage a profile
  piw install <pkg> [options]      Install a package into profiles
  piw update [options]             Update extensions in profiles
  piw compose <name>               Rebuild an inheriting profile's union
  piw <profile> [...]              Launch pi with a profile

Options (create):
  --name, -n <name>       Profile name
  --from, -f <source>     Source profile or _root_
  --empty                 Create empty profile
  --packages <list>       Comma-separated package sources
  --configs <list>        Comma-separated config files (models.json, etc.)
  --extensions, -e <list> Comma-separated extension names
  --skills, -s <list>     Comma-separated skill names
  --prompts <list>        Comma-separated prompt names
  --themes <list>         Comma-separated theme names
  --extends <list>        Comma-separated parent profiles (union at launch)
  --yes, -y               Skip confirmation

Options (list, show):
  --json                  Output as JSON

Options (delete, clone):
  --yes, -y               Skip confirmation

Options (install):
  --target, -t <list>     Comma-separated targets (_root_, profile names)
                          Default: all profiles + _root_

Options (update):
  --target, -t <list>     Comma-separated targets (_root_, profile names)
                          Default: all profiles + _root_

Options (manage):
  --show                  Show profile resources
  --copy-from <src>       Copy new items from another profile
  --extends <list>        Set parent profiles (union at launch), empty to clear
  --rename <new-name>     Rename the profile
  --delete-profile        Delete the profile
  --yes, -y               Skip confirmation`;

function csv(s: string | undefined): string[] | undefined {
  if (!s) return undefined;
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

async function main(): Promise<void> {
  const { positionals, values: v } = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: { type: "boolean", short: "h" },
      json: { type: "boolean" },
      yes: { type: "boolean", short: "y" },
      force: { type: "boolean" },
      name: { type: "string", short: "n" },
      from: { type: "string", short: "f" },
      empty: { type: "boolean" },
      packages: { type: "string" },
      configs: { type: "string" },
      extensions: { type: "string", short: "e" },
      skills: { type: "string", short: "s" },
      prompts: { type: "string" },
      themes: { type: "string" },
      extends: { type: "string" },
      target: { type: "string", short: "t" },
      show: { type: "boolean" },
      "copy-from": { type: "string" },
      rename: { type: "string" },
      "delete-profile": { type: "boolean" },
    },
    strict: false,
    allowPositionals: true,
  });

  if (v.help) {
    console.log(HELP);
    return;
  }

  const cmd = positionals[0];

  // Helper: coerce parseArgs values to the right types
  const flag = (key: string): boolean => v[key] === true;
  const str = (key: string): string | undefined =>
    typeof v[key] === "string" ? (v[key] as string) : undefined;

  // Security gate: every profile name a user passes on the CLI is turned into a
  // filesystem path (~/.pi/profiles/<name>). Reject anything that isn't a plain
  // identifier up front, so a name like "../../etc" can never escape that dir and
  // reach delete/rename/copy/spawn. `_root_` passes (it is all safe characters).
  const checkName = (label: string, ...names: (string | undefined)[]): void => {
    for (const n of names) {
      if (n !== undefined && !isSafeProfileName(n)) {
        console.error(
          `Invalid ${label} "${n}": only letters, numbers, hyphens and underscores are allowed`,
        );
        process.exit(1);
      }
    }
  };
  // Config filenames must be a single plain component (no separators, no "..")
  // so join(profileDir, filename) can't escape the profile dir.
  const SAFE_FILENAME = /^[A-Za-z0-9._-]+$/;
  const checkFilename = (label: string, ...names: (string | undefined)[]): void => {
    for (const n of names) {
      if (n === undefined) continue;
      if (!SAFE_FILENAME.test(n) || n === "." || n === "..") {
        console.error(`Invalid ${label} "${n}": must be a plain filename`);
        process.exit(1);
      }
    }
  };

  // ── Subcommands ──────────────────────────────────────────────

  if (cmd === "create") {
    const { create } = await import("./commands/create.js");
    const opts: CreateOptions = {
      name: str("name") ?? positionals[1],
      from: str("from"),
      empty: flag("empty"),
      packages: csv(str("packages")),
      configs: csv(str("configs")),
      extensions: csv(str("extensions")),
      skills: csv(str("skills")),
      prompts: csv(str("prompts")),
      themes: csv(str("themes")),
      extends: csv(str("extends")),
      yes: flag("yes"),
    };
    checkName("profile name", opts.name);
    checkName("source profile", opts.from);
    if (opts.extends) checkName("parent profile", ...opts.extends);
    if (opts.configs) checkFilename("config file", ...opts.configs);
    await create(opts);
    return;
  }

  if (cmd === "compose") {
    const target = positionals[1];
    if (!target) {
      console.error("Usage: piw compose <name>");
      process.exit(1);
    }
    checkName("profile name", target);
    const { composeForLaunch, readExtends } = await import(
      "./services/inherit.service.js"
    );
    if (readExtends(target).length === 0) {
      console.log(`Profile "${target}" declares no "extends" — nothing to compose`);
      return;
    }
    composeForLaunch(target);
    return;
  }

  if (cmd === "list") {
    const { list } = await import("./commands/list.js");
    const opts: ListOptions = { json: flag("json") };
    await list(opts);
    return;
  }

  if (cmd === "show") {
    const { show } = await import("./commands/show.js");
    const opts: ShowOptions = {
      name: positionals[1],
      json: flag("json"),
    };
    checkName("profile name", opts.name);
    await show(opts);
    return;
  }

  if (cmd === "clone") {
    const { clone } = await import("./commands/clone.js");
    const opts: CloneOptions = {
      source: positionals[1],
      target: positionals[2],
      yes: flag("yes"),
    };
    checkName("source profile", opts.source);
    checkName("target profile", opts.target);
    await clone(opts);
    return;
  }

  if (cmd === "rename") {
    checkName("profile name", positionals[1], positionals[2]);
    const { rename } = await import("./commands/rename.js");
    await rename(positionals[1], positionals[2]);
    return;
  }

  if (cmd === "delete") {
    const { deleteCmd } = await import("./commands/delete.js");
    const opts: DeleteOptions = {
      name: positionals[1],
      yes: flag("yes") || flag("force"),
    };
    checkName("profile name", opts.name);
    await deleteCmd(opts);
    return;
  }

  if (cmd === "manage") {
    const { manage } = await import("./commands/manage.js");
    const opts: ManageOptions = {
      profile: positionals[1],
      show: flag("show"),
      copyFrom: str("copy-from"),
      renameTo: str("rename"),
      deleteProfile: flag("delete-profile"),
      extends: csv(str("extends")),
      yes: flag("yes"),
    };
    checkName("profile", opts.profile);
    checkName("source profile", opts.copyFrom);
    checkName("new name", opts.renameTo);
    // "none"/"-" are the clear-inheritance sentinels and pass the name check.
    if (opts.extends) checkName("parent profile", ...opts.extends);
    await manage(opts);
    return;
  }

  if (cmd === "install") {
    const { install } = await import("./commands/install.js");
    const opts: InstallOptions = {
      pkg: positionals[1],
      targets: csv(str("target")),
    };
    if (opts.targets) checkName("target", ...opts.targets);
    await install(opts);
    return;
  }

  if (cmd === "update") {
    const { update } = await import("./commands/update.js");
    const opts: UpdateOptions = { targets: csv(str("target")) };
    if (opts.targets) checkName("target", ...opts.targets);
    await update(opts);
    return;
  }

  // ── Profile shortcut: piw <profile> ─────────────────────────
  if (cmd && !cmd.startsWith("-")) {
    const { listAllProfileDirs, profilePath } = await import(
      "./services/profile.service.js"
    );
    const profiles = listAllProfileDirs();
    // Check if it's a known profile or if we should treat it as one
    if (profiles.includes(cmd) || !["create", "compose", "list", "show", "clone", "rename", "delete", "manage", "install", "update"].includes(cmd)) {
      const dir = profilePath(cmd);
      // Only proceed if it's actually a profile directory
      if (profiles.includes(cmd)) {
        const { composeForLaunch } = await import(
          "./services/inherit.service.js"
        );
        composeForLaunch(cmd);
        console.log(`Launching pi with profile "${cmd}"...`);
        const proc = spawn(["pi", ...process.argv.slice(3)], {
          env: { ...process.env, PI_CODING_AGENT_DIR: dir },
          stdin: "inherit",
          stdout: "inherit",
          stderr: "inherit",
        });
        process.exit(await proc.exited);
      }
    }
  }

  // ── No args → interactive TUI ───────────────────────────────
  import("./commands/create.js"); // warm up all commands
  import("./commands/clone.js");
  import("./commands/manage.js");
  import("./commands/install.js");
  import("./commands/update.js");
  import("./commands/delete.js");
  import("./commands/rename.js");
  import("./commands/list.js");
  import("./commands/show.js");

  const { default: interactive } = await import("./interactive.js");
  await interactive();
}

await main();
