import { PRACTICE_HTML } from "@/lib/practice";

export function GET() {
  return new Response(PRACTICE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
