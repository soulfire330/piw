import {
  listAllProfileDirs,
  resolvePath,
} from "../services/profile.service.js";
import { spawn } from "../spawn.js";
import type { UpdateOptions } from "../types.js";

export async function update(opts: UpdateOptions = {}): Promise<void> {
  const home = process.env.HOME ?? "~";
  const profiles = listAllProfileDirs();

  let targets = opts.targets;
  let interactive = false;

  // Interactive mode: prompt for targets
  if (!targets) {
    interactive = true;

    const { cancel, intro, isCancel, multiselect } = await import(
      "@clack/prompts"
    );

    intro("piw — Update Extensions");

    const targetOptions: Array<{
      value: string;
      label: string;
      hint?: string;
    }> = [
      { value: "_root_", label: "_root_", hint: `${home}/.pi/agent/` },
      ...profiles.map((name) => ({
        value: name,
        label: name,
        hint: `${home}/.pi/profiles/${name}/`,
      })),
    ];

    const selected = await multiselect({
      message: "Update extensions in:",
      options: targetOptions,
      initialValues: targetOptions.map((o) => o.value),
      required: true,
    });

    if (isCancel(selected)) {
      cancel("Cancelled");
      return;
    }

    targets = selected as string[];
  }

  for (const target of targets) {
    const label = target === "_root_" ? "_root_" : target;
    console.log(`pi update --extensions → ${label}`);

    const proc = spawn(["pi", "update", "--extensions"], {
      env: { ...process.env, PI_CODING_AGENT_DIR: resolvePath(target) },
      stdout: "inherit",
      stderr: "inherit",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      console.error(`Failed: pi update exited with code ${exitCode}`);
      process.exit(exitCode);
    }
  }

  if (interactive) {
    const { outro } = await import("@clack/prompts");
    outro("Done");
  }
}
