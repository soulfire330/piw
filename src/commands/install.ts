import {
  cancel,
  intro,
  isCancel,
  log,
  outro,
  select,
  spinner,
  text,
} from "@clack/prompts";
import { listProfiles } from "../utils/profile.js";
import { profilePath } from "../utils/symlinks.js";

export async function install(): Promise<void> {
  intro("piw — Install Package");

  const profiles = listProfiles();

  if (profiles.length === 0) {
    log.warn("No profiles found. Create one first: piw create");
    outro("Done");
    return;
  }

  const target = await select({
    message: "Select profile to install into:",
    options: profiles.map((p) => ({
      value: p.name,
      label: p.name,
    })),
  });

  if (isCancel(target)) {
    cancel("Cancelled");
    return;
  }

  // Package arg: position 2 is the subcommand, position 3 is the package
  const argPkg = process.argv[3];

  const pkg =
    argPkg ||
    ((await text({
      message: "Package to install:",
      placeholder: "npm:some-package or git:github.com/user/repo",
      validate: (v) => {
        if (!v || v.trim().length === 0) return "Package is required";
        return undefined;
      },
    })) as string);

  if (isCancel(pkg)) {
    cancel("Cancelled");
    return;
  }

  const dir = profilePath(target);
  const spin = spinner();

  spin.start(`pi install ${pkg} → ${target}`);

  const proc = Bun.spawn(["pi", "install", pkg], {
    env: { ...process.env, PI_CODING_AGENT_DIR: dir },
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;

  if (exitCode === 0) {
    spin.stop(`Installed ${pkg} into "${target}"`);
  } else {
    const err = await new Response(proc.stderr).text();
    spin.stop(err.trim() || `pi install exited with code ${exitCode}`);
  }

  log.info(`Launch profile with: pi-profile ${target}`);
  outro("Done");
}
