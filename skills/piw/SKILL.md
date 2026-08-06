---
name: piw
description: >-
  Pi Profile Manager — create, clone, delete, rename, and manage pi coding agent
  profiles with granular resource inheritance. Use for piw, profile, profiles,
  управление профилями, создать профиль, удалить профиль, клонировать профиль,
  переименовать профиль, список профилей, установка пакетов в профили,
  pi install в профиль, обновить расширения, update extensions, bulk update, скопировать ресурсы между профилями, управление _root_.
---

# Pi Profile Manager (piw)

`piw` is a CLI tool and TUI for managing pi coding agent profiles.
Each profile lives in `~/.pi/profiles/<name>/` and inherits resources
(extensions, skills, prompts, themes, configs, packages) from `_root_`
(`~/.pi/agent/`) or from other profiles.

## Install

`piw` is a CLI tool — install it globally first:

```bash
npm install -g @soulfire330/piw
```

Then (optionally) register the skill so Pi can assist with piw commands:

```bash
pi install npm:@soulfire330/piw
```

## Quick reference

```bash
piw                        # Interactive TUI
piw --help                 # Full CLI reference

# CRUD
piw create -n <name> -f <source> [-y]   # Create from _root_ or profile
piw create -n <name> --empty            # Create empty profile
piw create -n <name> --extends a,b      # Inherit union of profiles a + b at launch
piw list                                # List profiles (human-readable)
piw list --json                         # List profiles (JSON)
piw show <name>                         # Show profile details
piw show <name> --json                  # Show profile details (JSON)
piw clone <src> <dst>                   # Clone profile
piw rename <old> <new>                  # Rename profile
piw delete <name> [-y]                  # Delete profile

# Package management
piw install <pkg>                       # Install package into all profiles + _root_
piw install <pkg> -t <p1,p2>           # Install into specific targets
piw update                              # Bulk update extensions in all profiles + _root_
piw update -t <p1,p2>                   # Update extensions in specific targets

# Advanced management
piw manage <name> --show                # Show profile resources
piw manage <name> --copy-from <src>     # Copy new items from another profile
piw manage <name> --extends a,b         # Set parent profiles (--extends none clears)
piw manage <name> --rename <new>        # Rename
piw manage <name> --delete-profile -y   # Delete profile

# Inheritance
piw compose <name>                      # Rebuild an inheriting profile's union

# Launch pi with a profile
piw <profile> [pi-args...]             # Sets PI_CODING_AGENT_DIR (composes first)
```

## Profile structure

```
~/.pi/profiles/<name>/
├── AGENTS.md           # Always local (identity)
├── APPEND_SYSTEM.md    # Always local
├── settings.json       # Packages list + optional "extends": [parents]
├── models.json         # Config (inheritable)
├── keybindings.json    # Config (inheritable)
├── extensions/         # Loose + package-provided
├── skills/             # Loose + package-provided
├── prompts/            # Loose + package-provided
├── themes/             # Loose + package-provided
├── sessions/           # Always local
└── memory/             # Always local
```

## Key concepts

### _root_
The base pi agent directory at `~/.pi/agent/`. Not a profile, but usable
as a source/target in `--from`, `--copy-from`, `--target` flags and in the
interactive TUI. Cannot be renamed or deleted.

### Packages vs loose resources
- **Packages** are declared in `settings.json` under `"packages"`. Pi
  auto-installs them on first launch. Managed via `pi install` / `pi remove`.
- **Loose resources** are files/directories copied directly into the profile's
  `extensions/`, `skills/`, `prompts/`, `themes/` directories.

### Copy vs inheritance — two distinct models
- **Copy (copy-on-write)** — `-f <source>` / `--copy-from` take a **one-time
  snapshot** of selected resources at creation/manage time. Profiles then diverge
  independently.
- **Inheritance (`extends`)** — a **living link**. A profile lists parent profiles
  and receives the **union** of their resources + packages, recomposed on every
  launch, so parent changes propagate automatically and nothing is duplicated.

### Copy model
When creating a profile from a source, you pick which resources to copy:
- **Packages** — declared in settings.json, pi installs them on launch
- **Config files** — `models.json`, `keybindings.json` (copied as files)
- **Loose resources** — individual items from extensions/skills/prompts/themes

After creation, use `piw manage <name> --copy-from <src>` to pull new
items from another profile or `_root_`.

### Inheritance model (`extends`)
A profile's `settings.json` may declare `"extends": ["common", "jakub"]`. Before
launch, `piw` composes the profile — materializing the **union** of all ancestors
into its own directory:
- **Loose resources** and **config files** are copied in.
- Parents' **packages** are merged into `settings.json` (pi installs the union).
- `sessions/`, `memory/`, `AGENTS.md` and `extends` itself are never touched.

Precedence: the profile's own files win; among parents, later-listed wins.
Inheritance is transitive (a parent may extend others; cycles are detected) and
idempotent — tracked via a `.piw-manifest.json` so stale inherited items are
removed on recompose. Runs automatically at launch; force with `piw compose <name>`.
Use this so a `jakub` profile need not repeat every tool already in `common`.

## CLI patterns

### Create a work profile from _root_
```bash
piw create -n work -f _root_
```
Copies all packages, configs, and loose resources from `_root_`.

### Create a minimal profile with specific packages
```bash
piw create -n minimal -f _root_ --packages npm:pi-env,npm:ponytail --yes
```

### Add a package to all profiles
```bash
piw install npm:some-package
```

### Update extensions in all profiles
```bash
piw update
```
Prompts you to pick targets (default: all profiles + `_root_`). Or pick
them directly:
```bash
piw update -t work,experiment
```

### Add a package only to _root_
```bash
piw install npm:some-package -t _root_
```

### Copy new resources from _root_ into a profile
```bash
piw manage myprofile --copy-from _root_
```
Copies all packages and loose resources that exist in `_root_` but not in
`myprofile`.

### Sync extensions from one profile to another
```bash
piw manage target --copy-from source
```

### Compose a profile from several others (inheritance)
```bash
piw create -n piw --extends common,jakub   # piw = union of common + jakub
piw manage jakub --extends common          # jakub now also inherits common
piw manage piw --extends none              # stop inheriting
```
The union is rebuilt automatically at launch; run `piw compose <name>` to rebuild
it on demand (e.g. after editing a parent).

### Launch pi with a profile and pass args
```bash
piw work -e npm:some-ext
```

## Interactive TUI

Run `piw` with no arguments for the interactive menu:
- **Run** — select a profile and launch pi
- **Create** — step-by-step profile creation with resource picker
- **Clone** — full copy of a profile
- **Manage** — show/copy/delete resources, rename, delete profile
- **Install** — install a package into selected targets

## Assisting users

When a user asks about pi profiles:

1. **List what exists** — `piw list --json` for programmatic access
2. **Inspect a profile** — `piw show <name> --json`
3. **Create profiles** — use `piw create` with `--yes` to skip prompts
4. **Install packages** — `piw install <pkg> -t <target>`
5. **Check _root_ resources** — `piw show _root_ --json` (shows base pi resources)

If the user wants automation, prefer CLI flags over interactive mode.
Only use bare `piw` (TUI) when the user explicitly wants interactive mode.
