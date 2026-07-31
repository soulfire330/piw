import {
  cancel,
  intro,
  isCancel,
  log,
  multiselect,
  outro,
  spinner,
  text,
} from "@clack/prompts";
import { listAllProfileDirs } from "../services/profile.service.js";
import { profilePath } from "../services/profile.service.js";

export async function install(): Promise<void> {
  intro("piw — Install Package");

  const profiles = listAllProfileDirs();

  if (profiles.length === 0) {
    log.warn("No profiles found. Create one first: piw create");
    outro("Done");
    return;
  }

  const targets = await multiselect({
    message: "Select profiles to install into:",
    options: profiles.map((name) => ({ value: name, label: name })),
    initialValues: profiles,
    required: true,
  });

  if (isCancel(targets)) {
    cancel("Cancelled");
    return;
  }

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

  for (const target of targets as string[]) {
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
  }

  log.info(`Launch profile with: piw <name>`);
  outro("Done");
}
