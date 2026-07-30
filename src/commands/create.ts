import {
  cancel,
  confirm,
  groupMultiselect,
  intro,
  isCancel,
  log,
  outro,
  tasks,
  text,
} from "@clack/prompts";
import {
  INHERIT_LABELS,
  INHERITABLE_DIRS,
  INHERITABLE_FILES,
  type InheritableKey,
} from "../types.js";
import { createProfile, defaultInherits } from "../utils/profile.js";

function inheritOption(key: InheritableKey) {
  return { value: key, label: INHERIT_LABELS[key] };
}

export async function create(): Promise<void> {
  intro("piw — Create Profile");

  const name = await text({
    message: "Profile name:",
    placeholder: "my-agent",
    validate: (v) => {
      if (!v || v.trim().length === 0) return "Name is required";
      if (!/^[a-z0-9_-]+$/i.test(v))
        return "Only letters, numbers, hyphens, underscores";
      return undefined;
    },
  });

  if (isCancel(name)) {
    cancel("Cancelled");
    return;
  }

  const defaults = defaultInherits();
  const defaultKeys = (Object.keys(defaults) as InheritableKey[]).filter(
    (k) => defaults[k],
  );

  const selected = await groupMultiselect({
    message: "Choose what to inherit from base Pi (~/.pi/agent/):",
    options: {
      Files: INHERITABLE_FILES.map(inheritOption),
      Directories: INHERITABLE_DIRS.map(inheritOption),
    },
    initialValues: defaultKeys,
    required: false,
  });

  if (isCancel(selected)) {
    cancel("Cancelled");
    return;
  }

  const inherits: Record<InheritableKey, boolean> = { ...defaults };
  for (const key of Object.keys(inherits) as InheritableKey[])
    inherits[key] = false;
  for (const s of selected) inherits[s as InheritableKey] = true;

  const proceed = await confirm({
    message: `Create profile "${name}"?`,
    active: "Create",
    inactive: "Cancel",
  });

  if (isCancel(proceed) || !proceed) {
    cancel("Cancelled");
    return;
  }

  await tasks([
    {
      title: `Creating profile "${name}"`,
      task: async () => {
        createProfile(name, inherits);
        return `Profile "${name}" created at ~/.pi/profiles/${name}/`;
      },
    },
  ]);

  log.success(`Launch with: pi-profile ${name}`);
  outro("Done");
}
