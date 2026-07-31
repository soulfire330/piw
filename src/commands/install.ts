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
import { listAllProfileDirs, basePath } from "../services/profile.service.js";

export async function install(): Promise<void> {
  intro("piw — Install Package");

  const profiles = listAllProfileDirs();
  const home = process.env.HOME ?? "~";

  const targetOptions: Array<{ value: string; label: string; hint?: string }> = [
    { value: "_root_", label: "_root_", hint: `${home}/.pi/agent/` },
    ...profiles.map((name) => ({
      value: name,
      label: name,
      hint: `${home}/.pi/profiles/${name}/`,
    })),
  ];

  const targets = await multiselect({
    message: "Install into:",
    options: targetOptions,
    initialValues: targetOptions.map((o) => o.value),
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
    const dir = target === "_root_" ? basePath() : `${home}/.pi/profiles/${target}`;
    const label = target === "_root_" ? "_root_" : target;
    const spin = spinner();

    spin.start(`pi install ${pkg} → ${label}`);

    const proc = Bun.spawn(["pi", "install", pkg], {
      env: { ...process.env, PI_CODING_AGENT_DIR: dir },
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;

    if (exitCode === 0) {
      spin.stop(`Installed ${pkg} into "${label}"`);
    } else {
      const err = await new Response(proc.stderr).text();
      spin.stop(err.trim() || `pi install exited with code ${exitCode}`);
    }
  }

  log.info(`Launch profile with: piw <name>`);
  outro("Done");
}
