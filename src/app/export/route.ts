import { OUTCOME_LABEL, STATUS_LABEL } from "@/lib/labels";
import { readDb } from "@/lib/store";

const cell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Every application as a CSV you can open in Excel or Google Sheets. */
export async function GET() {
  const db = await readDb();
  const jobs = new Map(db.jobs.map((j) => [j.id, j]));
  const rows = [
    ["Company", "Role", "Location", "Status", "Outcome", "Submitted", "Score", "Posting", "Notes"],
    ...db.applications.map((a) => {
      const j = jobs.get(a.jobId);
      return [
        j?.company,
        j?.title,
        j?.location,
        STATUS_LABEL[a.status],
        a.outcome ? OUTCOME_LABEL[a.outcome] : "",
        a.submittedAt?.slice(0, 10),
        j?.score,
        j?.url,
        a.notes,
      ];
    }),
  ];
  const csv = rows.map((r) => r.map(cell).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="internship-applications-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
