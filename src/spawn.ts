import { spawn as nodeSpawn } from "node:child_process";

export function spawn(
  cmd: string[],
  opts: {
    env?: Record<string, string>;
    stdin?: "inherit" | "pipe";
    stdout?: "inherit" | "pipe";
    stderr?: "inherit" | "pipe";
  } = {},
) {
  const s: Array<"inherit" | "pipe"> = [
    opts.stdin ?? "inherit",
    opts.stdout ?? "inherit",
    opts.stderr ?? "inherit",
  ];
  const allInherit = s.every((x) => x === "inherit");

  // biome-ignore lint/suspicious/noExplicitAny: Node types for stdio are a mess
  const proc = nodeSpawn(cmd[0]!, cmd.slice(1), {
    env: opts.env,
    stdio: (allInherit ? "inherit" : s) as any,
  });

  return {
    exited: new Promise<number>((resolve) => {
      // biome-ignore lint/suspicious/noExplicitAny: cast to escape never-reduced union
      (proc as any).on("close", (code: number | null) => resolve(code ?? 1));
    }),
    // biome-ignore lint/suspicious/noExplicitAny: cast to escape never-reduced union
    stdout: (proc as any).stdout as NodeJS.ReadableStream | null,
    // biome-ignore lint/suspicious/noExplicitAny: cast to escape never-reduced union
    stderr: (proc as any).stderr as NodeJS.ReadableStream | null,
  };
}
