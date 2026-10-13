import { isInternship } from "../match";
import type { Job } from "../types";

type LeverPosting = {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl: string;
  createdAt?: number;
  descriptionPlain?: string;
  additionalPlain?: string;
  lists?: { text: string; content: string }[];
  categories?: { location?: string; commitment?: string; team?: string };
};

export function parseLever(board: string, postings: LeverPosting[], now = new Date().toISOString()): Job[] {
  return postings
    .filter((p) => isInternship(p.text, p.categories?.commitment ?? ""))
    .map((p) => ({
      id: `lever:${board}:${p.id}`,
      source: "lever" as const,
      board,
      externalId: p.id,
      company: board.charAt(0).toUpperCase() + board.slice(1),
      title: p.text.trim(),
      location: p.categories?.location ?? "",
      url: p.hostedUrl,
      applyUrl: p.applyUrl,
      description: [
        p.descriptionPlain ?? "",
        ...(p.lists ?? []).map((l) => `${l.text}\n${l.content.replace(/<[^>]+>/g, " ")}`),
        p.additionalPlain ?? "",
      ].join("\n\n").trim(),
      postedAt: p.createdAt ? new Date(p.createdAt).toISOString() : now,
      fetchedAt: now,
    }));
}

export async function fetchLever(board: string): Promise<Job[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(board)}?mode=json`);
  if (!res.ok) throw new Error(`Lever board "${board}" returned ${res.status}`);
  return parseLever(board, await res.json());
}
