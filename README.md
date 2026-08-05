# piw — Pi Profile Manager

Profile manager for [Pi](https://pi.dev) coding agent — independent per-profile packages, extensions, skills, prompts, and themes. Managed through an interactive TUI, with full CLI for scripting and automation.

## Why piw?

Out of the box, Pi uses a single directory (`~/.pi/agent/`) for everything — packages, extensions, skills, configs. This works until you need different setups for different projects or contexts.

**piw** gives you isolated profiles. Each profile is a separate directory under `~/.pi/profiles/<name>/` with its own packages, skills, prompts, themes, and configs. Think VS Code profiles, but for your coding agent — switch contexts instantly, install packages per profile without affecting others, and experiment without breaking your main setup.

## TUI

Run `piw` with no arguments to enter the interactive menu:

```
piw
```

### What you can do in the TUI

**Run** — pick a profile and launch Pi with it. All profiles listed, one keystroke.

**Create** — build a new profile step by step:
- Name it
- Pick a source: `_root_` (base Pi), any existing profile, or start empty
- Granular resource picker — checkboxes for every package, config file, extension, skill, prompt, and theme available in the source

**Clone** — full copy of an existing profile. All packages, resources, and configs. Instant duplicate for experimentation.

**Manage** — select a profile, then:
- **Show resources** — see every package, loose resource, and package-provided item
- **Copy from another profile** — pull in new packages and resources from `_root_` or another profile. Multiselect picker — choose exactly what to bring over
- **Delete items** — remove packages or loose resources from the profile
- **Rename** or **Delete** the profile

**Install** — pick a package (npm or git), pick which profiles to install it into (including `_root_`). One command, multiple targets.

**Update extensions** — bulk-run `pi update --extensions` across the profiles you select (including `_root_`). Multiselect, one pass.

## CLI quick examples

Everything the TUI can do is also available non-interactively:

```bash
piw create -n work -f _root_                     # Create from root
piw create -n minimal -f _root_ --packages npm:ponytail,npm:pi-env -y
piw clone work experiment                        # Clone
piw install npm:some-pkg -t work,experiment      # Install into specific profiles
piw update -t work,experiment                     # Update extensions in specific profiles
piw manage work --copy-from _root_               # Pull new items from root
piw list --json                                  # Machine-readable output
piw work                                         # Launch Pi with profile
```

`piw --help` for the full reference.

## How profiles work

```
~/.pi/
├── agent/                    # _root_ — base Pi directory
│   ├── settings.json
│   ├── extensions/
│   ├── skills/
│   ├── prompts/
│   └── themes/
│
└── profiles/
    └── work/                 # An isolated profile
        ├── settings.json     # Own package list (auto-installed on launch)
        ├── extensions/       # Per-profile
        ├── skills/           # Per-profile
        ├── prompts/          # Per-profile
        ├── themes/           # Per-profile
        ├── models.json       # Copied from source
        ├── keybindings.json
        ├── AGENTS.md         # Always unique
        ├── sessions/         # Always unique
        └── memory/           # Always unique
```

Copy-on-write: inherit resources at creation time, then profiles diverge independently. No symlinks, no shared state. Launch with `piw <name>` — Pi sees that profile's directory as its agent root and auto-installs declared packages on first run.

## Install

> **Important:** `piw` is a CLI tool. You need a global install first so the `piw` command is on your PATH. The Pi package install is optional — it only adds the skill so Pi can help you use piw commands.

```bash
# Step 1 — global CLI (REQUIRED)
npm install -g @soulfire330/piw
# or
bun install -g @soulfire330/piw

# Step 2 — Pi skill (optional, lets Pi suggest piw commands)
pi install npm:@soulfire330/piw
```

Requires Node ≥18 or Bun ≥1.1.

## Dev

```bash
bun install
bun run dev          # Run TS directly
bun run build        # Compile TS → JS
bun run typecheck    # tsc --noEmit
```

---

Inspired by [@sovorn/pi-profile](https://github.com/sovorn/pi-profile) ❤️
