import Link from "next/link";
import { hideJob, prepareAction, refreshJobsAction } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { Submit } from "@/components/Submit";
import { readDb } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ msg?: string; all?: string; q?: string }> }) {
  const { msg, all, q } = await searchParams;
  const db = await readDb();
  const appByJob = new Map(db.applications.map((a) => [a.jobId, a]));
  const needle = (q ?? "").toLowerCase();
  const jobs = db.jobs
    .filter((j) => (all ? true : !j.hidden && (j.score ?? 0) >= db.profile.preferences.minScore))
    .filter((j) => !needle || `${j.title} ${j.company} ${j.location}`.toLowerCase().includes(needle))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.postedAt.localeCompare(a.postedAt));

  return (
    <>
      <div className="spread">
        <div>
          <h1>Internships</h1>
          <p className="lead">
            {db.jobs.length} internships from {db.settings.boards.length} company job boards, best matches first.
          </p>
        </div>
        <form action={refreshJobsAction}>
          <Submit className="primary" pending="Searching job boards…">Search for new internships</Submit>
        </form>
      </div>
      <Flash msg={msg} />
      <form className="row" style={{ marginBottom: 8 }}>
        <input name="q" placeholder="Filter by title, company or place" defaultValue={q} style={{ maxWidth: 320 }} />
        <label className="inline">
          <input type="checkbox" name="all" value="1" defaultChecked={Boolean(all)} /> Include hidden and low scores
        </label>
        <button type="submit">Filter</button>
      </form>
      {jobs.length === 0 && <p className="muted">Nothing to show yet. Search for internships, or lower the minimum score on your profile.</p>}
      {jobs.map((j) => {
        const app = appByJob.get(j.id);
        return (
          <div className="card spread" key={j.id}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <strong>{j.title}</strong> · {j.company}
              <div className="small muted">
                {j.location || "Location not stated"} · posted {j.postedAt.slice(0, 10)} · via {j.source}
              </div>
              <div>{j.reasons?.map((r) => <span className="chip" key={r}>{r}</span>)}</div>
              <div className="row small" style={{ marginTop: 6 }}>
                <a href={j.url} target="_blank" rel="noreferrer">Read the posting</a>
                <form action={hideJob}>
                  <input type="hidden" name="jobId" value={j.id} />
                  <button className="link">{j.hidden ? "Unhide" : "Not interested"}</button>
                </form>
              </div>
            </div>
            <div className="row">
              <span className="score" title="Match score">{j.score ?? "–"}</span>
              {app ? (
                <Link className="button" href={`/applications/${app.id}`}>
                  {app.status === "submitted" ? "Applied" : "Open application"}
                </Link>
              ) : (
                <form action={prepareAction}>
                  <input type="hidden" name="jobId" value={j.id} />
                  <Submit className="primary" pending="Filling in…">Prepare application</Submit>
                </form>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
