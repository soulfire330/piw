# piw — Pi Profile Manager

Profile manager for [Pi](https://pi.dev) coding agent with TUI and independent per-profile package installation.

- **Create** profiles from `_root_` or other profiles with granular resource selection
- **Clone** profiles with all packages and resources
- **Manage** — copy/delete resources, rename, delete profiles, manage `_root_`
- **Install** packages into selected profiles or `_root_`
- **JSON output** for scripting (`--json`)

## Install

```bash
npm install -g @soulfire330/piw
# or
bun install -g @soulfire330/piw
```

Or via pi package manager (installs the skill):

```bash
pi install npm:@soulfire330/piw
```

## How it works

Each profile lives in `~/.pi/profiles/<name>/` with its own copy of resources.
Packages are declared in `settings.json` and auto-installed by pi on first launch.

| Resource | Behavior |
|---|---|
| `settings.json` | Per-profile package list |
| `models.json` | Copied from source |
| `keybindings.json` | Copied from source |
| `extensions/` | Per-profile copy |
| `skills/` | Per-profile copy |
| `prompts/` | Per-profile copy |
| `themes/` | Per-profile copy |
| `AGENTS.md` | Always local |
| `sessions/` | Always local |
| `memory/` | Always local |

## Usage

```bash
piw                         # Interactive TUI
piw --help                  # Full CLI reference

# CRUD
piw create -n work -f _root_           # Create from _root_
piw create -n empty --empty            # Create empty profile
piw list                               # List profiles
piw list --json                        # List profiles (JSON)
piw show work                          # Show profile details
piw show work --json                   # Show profile details (JSON)
piw clone work work2                   # Clone profile
piw rename old new                     # Rename profile
piw delete work -y                     # Delete profile

# Packages
piw install npm:some-pkg               # Install into all profiles + _root_
piw install npm:some-pkg -t work       # Install into specific profile

# Manage
piw manage work --show                 # Show resources
piw manage work --copy-from _root_     # Copy new items from _root_
piw manage work --rename newname       # Rename
piw manage work --delete-profile -y    # Delete profile

# Launch pi
piw work                               # Launch pi with profile
piw work --help                        # Pass args to pi
```

## Dev

```bash
bun install
bun run dev          # Run directly (TS, no build)
bun run build        # Compile TS → JS
bun run typecheck    # tsc --noEmit
bun run lint         # biome check .
bun run format       # biome format --write .
```
