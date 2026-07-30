import { cancel, intro, isCancel, select } from "@clack/prompts";
import { create } from "./commands/create.js";
import { delete_ } from "./commands/delete.js";
import { list } from "./commands/list.js";
import { rename } from "./commands/rename.js";
import { sync } from "./commands/sync.js";

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

  const mode = await select({
    message: "What would you like to do?",
    options: Object.entries(MODES).map(([value, { label, hint }]) => ({
      value,
      label,
      hint,
    })),
  });

  if (isCancel(mode)) {
    cancel("Goodbye");
    return;
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
    return;
  }

  await interactive();
}

await main();
