import Link from "next/link";
import { hideJob, markAppliedExternally, prepareAction, prepareBestAction, refreshJobsAction } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { Submit } from "@/components/Submit";
import { readDb } from "@/lib/store";

export const dynamic = "force-dynamic";

const PAGE = 60;

type Params = { msg?: string; all?: string; q?: string; auto?: string; limit?: string; sort?: string };

export default async function JobsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { msg, all, q, auto, sort } = params;
  const limit = Math.max(PAGE, Number(params.limit) || PAGE);
  const db = await readDb();
  const appByJob = new Map(db.applications.map((a) => [a.jobId, a]));
  const needle = (q ?? "").toLowerCase();
  const matching = db.jobs
    .filter((j) => (all ? true : !j.hidden && (j.score ?? 0) >= db.profile.preferences.minScore))
    .filter((j) => !auto || j.source !== "external")
    .filter((j) => !needle || `${j.title} ${j.company} ${j.location}`.toLowerCase().includes(needle))
    .sort((a, b) =>
      sort === "new"
        ? b.postedAt.localeCompare(a.postedAt)
        : (b.score ?? 0) - (a.score ?? 0) || b.postedAt.localeCompare(a.postedAt),
    );
  const jobs = matching.slice(0, limit);
  const fillable = db.jobs.filter((j) => j.source !== "external").length;
  const more = new URLSearchParams(Object.entries({ ...params, msg: "", limit: String(limit + PAGE) }).filter(([, v]) => v) as [string, string][]);

  return (
    <>
      <div className="spread">
        <div>
          <h1>Internships</h1>
          <p className="lead">
            {db.jobs.length} open internships, {fillable} of them on sites the app can fill in. 
            {db.settings.lastSearchAt && ` Last searched ${db.settings.lastSearchAt.slice(0, 16).replace("T", " ")}.`}
          </p>
        </div>
        <div className="row">
          <form action={refreshJobsAction}>
            <Submit className="primary" pending="Searching job boards…">Search for new internships</Submit>
          </form>
        </div>
      </div>
      <Flash msg={msg} />
      <form action={prepareBestAction} className="card row">
        <span>Prepare drafts for the best</span>
        <input name="count" type="number" min={1} max={25} defaultValue={5} style={{ width: 70 }} />
        <span>matches you haven&apos;t looked at.</span>
        <Submit pending="Starting…">Prepare</Submit>
        <span className="small muted">Nothing is sent until you approve each one.</span>
      </form>
      <form className="row" style={{ marginBottom: 8 }}>
        <input name="q" placeholder="Filter by title, company or place" defaultValue={q} style={{ maxWidth: 320 }} />
        <label className="inline">
          <input type="checkbox" name="auto" value="1" defaultChecked={Boolean(auto)} /> Only ones the app can fill in
        </label>
        <label className="inline">
          <input type="checkbox" name="all" value="1" defaultChecked={Boolean(all)} /> Include hidden and low scores
        </label>
        <select name="sort" defaultValue={sort ?? ""} style={{ width: 150 }}>
          <option value="">Best match</option>
          <option value="new">Newest</option>
        </select>
        <button type="submit">Filter</button>
      </form>
      {jobs.length === 0 && <p className="muted">Nothing to show yet. Search for internships, or lower the minimum score on your profile.</p>}
      {jobs.map((j) => {
        const app = appByJob.get(j.id);
        const isNew = j.firstSeenAt && db.settings.lastSearchAt && j.firstSeenAt === db.settings.lastSearchAt;
        return (
          <div className="card spread" key={j.id}>
            <div style={{ flex: 1, minWidth: 240 }}>
              {isNew && <span className="chip">New</span>}
              <strong>{j.title}</strong> · {j.company}
              <div className="small muted">
                {j.location || "Location not stated"} · posted {j.postedAt.slice(0, 10)} ·{" "}
                {j.source === "external" ? "you apply on their site" : `the app can fill this in (${j.source})`}
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
              ) : j.source === "external" ? (
                <form action={markAppliedExternally} className="row">
                  <a className="button primary" href={j.applyUrl} target="_blank" rel="noreferrer">Apply on site</a>
                  <input type="hidden" name="jobId" value={j.id} />
                  <button className="link small">I applied</button>
                </form>
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
      {matching.length > jobs.length && (
        <Link href={`/jobs?${more.toString()}`}>Show more ({matching.length - jobs.length} left)</Link>
      )}
    </>
  );
}
