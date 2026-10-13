import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Flash } from "@/components/Flash";
import { batch, recoverInterrupted } from "@/lib/applications";
import { STATUS_LABEL } from "@/lib/labels";
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
      <h1>Applications</h1>
      <p className="lead">Nothing is sent until you open a draft and approve it.</p>
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
      {apps.map((a) => {
        const job = jobs.get(a.jobId);
        const missing = a.fields.filter((f) => f.required && !f.value).length;
        return (
          <Link key={a.id} href={`/applications/${a.id}`} className="card spread" style={{ display: "flex", color: "inherit", textDecoration: "none" }}>
            <div>
              <strong>{job?.title ?? "Closed posting"}</strong> · {job?.company}
              <div className="small muted">
                Updated {a.updatedAt.slice(0, 16).replace("T", " ")}
                {a.status === "draft" && missing > 0 ? ` · ${missing} required answer${missing === 1 ? "" : "s"} missing` : ""}
              </div>
            </div>
            <span className={`status-${a.status}`}>{STATUS_LABEL[a.status]}</span>
          </Link>
        );
      })}
    </>
  );
}
