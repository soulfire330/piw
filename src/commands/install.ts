import type { InstallOptions } from "../types.js";
import { listAllProfileDirs, basePath } from "../services/profile.service.js";
import { spawn } from "../spawn.js";

export async function install(pkgOrOpts?: string | InstallOptions): Promise<void> {
  const opts: InstallOptions =
    typeof pkgOrOpts === "string" ? { pkg: pkgOrOpts } : (pkgOrOpts ?? {});

  const home = process.env.HOME ?? "~";
  const profiles = listAllProfileDirs();

  let pkg = opts.pkg;
  let targets = opts.targets;

  // Interactive mode: prompt for targets and package
  if (!pkg || !targets) {
    const { cancel, intro, isCancel, log, multiselect, outro, text } =
      await import("@clack/prompts");

    intro("piw — Install Package");

    if (!targets) {
      const targetOptions: Array<{ value: string; label: string; hint?: string }> = [
        { value: "_root_", label: "_root_", hint: `${home}/.pi/agent/` },
        ...profiles.map((name) => ({
          value: name,
          label: name,
          hint: `${home}/.pi/profiles/${name}/`,
        })),
      ];

      const selected = await multiselect({
        message: "Install into:",
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

    if (!pkg) {
      const val = await text({
        message: "Package to install:",
        placeholder: "npm:some-package or git:github.com/user/repo",
        validate: (v) => {
          if (!v || v.trim().length === 0) return "Package is required";
          return undefined;
        },
      });

      if (isCancel(val)) {
        cancel("Cancelled");
        return;
      }

      pkg = val as string;
    }

    // Run installs
    for (const target of targets) {
      const dir = target === "_root_" ? basePath() : `${home}/.pi/profiles/${target}`;
      const label = target === "_root_" ? "_root_" : target;
      const { spinner } = await import("@clack/prompts");
      const spin = spinner();

      spin.start(`pi install ${pkg} → ${label}`);

      const proc = spawn(["pi", "install", pkg], {
        env: { ...process.env, PI_CODING_AGENT_DIR: dir },
        stdout: "pipe",
        stderr: "pipe",
      });

      const exitCode = await proc.exited;

      if (exitCode === 0) {
        spin.stop(`Installed ${pkg} into "${label}"`);
      } else {
        const err = await proc.stderr;
        spin.stop(err.trim() || `pi install exited with code ${exitCode}`);
      }
    }

    log.info(`Launch profile with: piw <name>`);
    outro("Done");
    return;
  }

  // Non-interactive mode
  for (const target of targets) {
    const dir = target === "_root_" ? basePath() : `${home}/.pi/profiles/${target}`;
    const label = target === "_root_" ? "_root_" : target;
    console.log(`pi install ${pkg} → ${label}`);

    const proc = spawn(["pi", "install", pkg], {
      env: { ...process.env, PI_CODING_AGENT_DIR: dir },
      stdout: "inherit",
      stderr: "inherit",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      console.error(`Failed: pi install exited with code ${exitCode}`);
      process.exit(exitCode);
    }
  }

  console.log(`Launch profile with: piw <name>`);
}
