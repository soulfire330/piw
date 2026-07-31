import { parseArgs } from "node:util";
import type {
  CreateOptions,
  CloneOptions,
  DeleteOptions,
  InstallOptions,
  ManageOptions,
  ListOptions,
  ShowOptions,
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
  --yes, -y               Skip confirmation

Options (list, show):
  --json                  Output as JSON

Options (delete, clone):
  --yes, -y               Skip confirmation

Options (install):
  --target, -t <list>     Comma-separated targets (_root_, profile names)
                          Default: all profiles + _root_

Options (manage):
  --show                  Show profile resources
  --copy-from <src>       Copy new items from another profile
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
      yes: flag("yes"),
    };
    await create(opts);
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
    await clone(opts);
    return;
  }

  if (cmd === "rename") {
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
      yes: flag("yes"),
    };
    await manage(opts);
    return;
  }

  if (cmd === "install") {
    const { install } = await import("./commands/install.js");
    const opts: InstallOptions = {
      pkg: positionals[1],
      targets: csv(str("target")),
    };
    await install(opts);
    return;
  }

  // ── Profile shortcut: piw <profile> ─────────────────────────
  if (cmd && !cmd.startsWith("-")) {
    const { listAllProfileDirs, profilePath } = await import(
      "./services/profile.service.js"
    );
    const profiles = listAllProfileDirs();
    // Check if it's a known profile or if we should treat it as one
    if (profiles.includes(cmd) || !["create", "list", "show", "clone", "rename", "delete", "manage", "install"].includes(cmd)) {
      const dir = profilePath(cmd);
      // Only proceed if it's actually a profile directory
      if (profiles.includes(cmd)) {
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
  }

  // ── No args → interactive TUI ───────────────────────────────
  import("./commands/create.js"); // warm up all commands
  import("./commands/clone.js");
  import("./commands/manage.js");
  import("./commands/install.js");
  import("./commands/delete.js");
  import("./commands/rename.js");
  import("./commands/list.js");
  import("./commands/show.js");

  const { default: interactive } = await import("./interactive.js");
  await interactive();
}

await main();
