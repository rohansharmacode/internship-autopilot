import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Flash } from "@/components/Flash";
import { batch, recoverInterrupted } from "@/lib/applications";
import { OUTCOME_LABEL, STATUS_LABEL } from "@/lib/labels";
import { readDb } from "@/lib/store";
import type { ApplicationStatus } from "@/lib/types";

export const dynamic = "force-dynamic";


const ORDER: ApplicationStatus[] = ["needs_you", "draft", "sending", "failed", "submitted", "skipped"];

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  await recoverInterrupted();
  const db = await readDb();
  const jobs = new Map(db.jobs.map((j) => [j.id, j]));
  const apps = [...db.applications].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || b.updatedAt.localeCompare(a.updatedAt));
  return (
    <>
      <AutoRefresh active={batch.running || apps.some((a) => a.status === "sending")} />
      <div className="spread">
        <div>
          <h1>Applications</h1>
          <p className="lead">Nothing is sent until you open a draft and approve it.</p>
        </div>
        {apps.length > 0 && <a className="button" href="/export">Download as a spreadsheet</a>}
      </div>
      <Flash msg={msg} />
      {batch.running && (
        <div className="card">
          Preparing drafts: {batch.done} of {batch.total} done.
        </div>
      )}
      {!batch.running && batch.failed.length > 0 && (
        <div className="card small">
          Some drafts could not be prepared:
          <ul>{batch.failed.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
      )}
      {apps.length === 0 && (
        <p className="muted">
          No applications yet. Pick one from <Link href="/jobs">Internships</Link>.
        </p>
      )}
      {apps.length > 0 && (
        <div className="panel">
          {apps.map((a) => {
            const job = jobs.get(a.jobId);
            const missing = a.fields.filter((f) => f.required && !f.value).length;
            return (
              <Link key={a.id} href={`/applications/${a.id}`} className="panel-row">
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontWeight: 600 }}>{job?.company ?? "Closed posting"}</div>
                  <div className="small muted">
                    {job?.title}
                    {a.status === "draft" && missing > 0 ? ` · ${missing} required answer${missing === 1 ? "" : "s"} missing` : ""}
                  </div>
                </div>
                <div className="row">
                  {a.byAutopilot && <span className="tag">autopilot</span>}
                  <span className="small muted">{a.updatedAt.slice(0, 10)}</span>
                  <span className={`status status-${a.status}`}>
                    {a.status === "submitted" && a.outcome ? OUTCOME_LABEL[a.outcome] : STATUS_LABEL[a.status]}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
