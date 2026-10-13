import { promises as fs } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/lib/store";

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!/^[\w-]+\.png$/.test(file)) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(path.join(DATA_DIR, "screens", file));
    return new Response(new Uint8Array(data), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
