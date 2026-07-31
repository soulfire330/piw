import { profilePath } from "./profile.service.js";

export async function piInstall(profile: string, pkg: string): Promise<{ ok: boolean; error?: string }> {
  const proc = Bun.spawn(["pi", "install", pkg], {
    env: { ...process.env, PI_CODING_AGENT_DIR: profilePath(profile) },
    stdout: "pipe",
    stderr: "pipe",
  });
  const code = await proc.exited;
  if (code === 0) return { ok: true };
  const err = await new Response(proc.stderr).text();
  return { ok: false, error: err.trim() || `pi install exited with code ${code}` };
}

export async function piRemove(profile: string, pkg: string): Promise<{ ok: boolean; error?: string }> {
  const proc = Bun.spawn(["pi", "remove", pkg], {
    env: { ...process.env, PI_CODING_AGENT_DIR: profilePath(profile) },
    stdout: "pipe",
    stderr: "pipe",
  });
  const code = await proc.exited;
  if (code === 0) return { ok: true };
  const err = await new Response(proc.stderr).text();
  return { ok: false, error: err.trim() || `pi remove exited with code ${code}` };
}
