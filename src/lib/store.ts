import { promises as fs } from "node:fs";
import path from "node:path";
import { emptyDb } from "./defaults";
import type { Db } from "./types";

/** Everything lives on your own machine: data/db.json plus uploaded files in data/files. */
export const DATA_DIR = process.env.AUTOPILOT_DATA_DIR ?? path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
export const FILES_DIR = path.join(DATA_DIR, "files");

let queue: Promise<unknown> = Promise.resolve();

export async function readDb(): Promise<Db> {
  try {
    const raw = JSON.parse(await fs.readFile(DB_PATH, "utf8")) as Partial<Db>;
    const base = emptyDb();
    return {
      ...base,
      ...raw,
      profile: {
        ...base.profile,
        ...raw.profile,
        answers: { ...base.profile.answers, ...raw.profile?.answers },
        preferences: { ...base.profile.preferences, ...raw.profile?.preferences },
      },
      settings: { ...base.settings, ...raw.settings, autopilot: { ...base.settings.autopilot, ...raw.settings?.autopilot } },
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return emptyDb();
    throw err;
  }
}

/** Serialises writes so two requests never interleave a read-modify-write. */
export function updateDb<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await readDb();
    const result = await fn(db);
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${DB_PATH}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db, null, 2));
    await fs.rename(tmp, DB_PATH);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function saveFile(name: string, data: Buffer): Promise<string> {
  await fs.mkdir(FILES_DIR, { recursive: true });
  const safe = name.replace(/[^\w.-]+/g, "_");
  const target = path.join(FILES_DIR, safe);
  await fs.writeFile(target, data);
  return target;
}

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
