# piw — Pi Profile Manager

Interactive CLI for managing [Pi](https://pi.dev) profiles — like VS Code profiles, but for your coding agent.

- **Create** profiles with granular inheritance control
- **List** profiles and their symlink status
- **Delete** profiles
- **Rename** profiles
- **Sync** — toggle what's inherited from base Pi on the fly

## How it works

Each profile lives in `~/.pi/profiles/<name>/` and has a `profile.json` tracking which resources are inherited (symlinked) from base Pi (`~/.pi/agent/`).

| Resource | Inheritable? |
|---|---|
| `auth.json` | Symlink to shared credentials |
| `models.json` | Symlink to shared models |
| `settings.json` | Symlink or local copy |
| `keybindings.json` | Symlink or local copy |
| `extensions/` | Symlink or local dir |
| `skills/` | Symlink or local dir |
| `prompts/` | Symlink or local dir |
| `themes/` | Symlink or local dir |
| `AGENTS.md` | Always local (identity) |
| `sessions/` | Always local |
| `memory/` | Always local |

## Install

```bash
bun install -g @soulfire330/piw
```

Or run directly:

```bash
bun run bin/piw.ts
```

## Usage

```bash
piw          # Interactive mode
piw create   # Create a new profile
piw list     # List all profiles
piw delete   # Delete a profile
piw rename   # Rename a profile
piw sync     # Toggle inheritance for an existing profile
```

## Dev

```bash
bun install
bun run typecheck   # tsc --noEmit
bun run lint        # biome check .
bun run format      # biome format --write .
```
