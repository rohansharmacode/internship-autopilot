import Link from "next/link";
import { addJobFromLink, hideJob, markAppliedExternally, prepareAction, prepareBestAction, refreshJobsAction } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { Score } from "@/components/Score";
import { Submit } from "@/components/Submit";
import { readDb } from "@/lib/store";
import type { Job } from "@/lib/types";

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

  const FROM: Record<Job["via"], string> = { board: "Job board", community: "SimplifyJobs list", tracker: "Simplytk tracker", link: "Added by you" };

  return (
    <>
      <div className="spread">
        <div>
          {db.jobs.length > 0 && <span className="pill">{db.jobs.length.toLocaleString()} open internships, {fillable.toLocaleString()} the app can fill in</span>}
          <h1>Internships</h1>
          <p className="lead">
            From company job boards, the simplytk.com tracker and the SimplifyJobs list.
            {db.settings.lastSearchAt && ` Last searched ${db.settings.lastSearchAt.slice(0, 16).replace("T", " ")}.`}
          </p>
        </div>
        <form action={refreshJobsAction}>
          <Submit className="primary" pending="Searching…">Search for new internships</Submit>
        </form>
      </div>
      <Flash msg={msg} />
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <form action={addJobFromLink} className="card stack" style={{ margin: 0 }}>
          <div>
            <h3>Add one from a link</h3>
            <p className="small muted" style={{ margin: 0 }}>
              Found one on Trackr or anywhere else? Press its Apply button and paste the address of the page that opens.
            </p>
          </div>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <input name="url" type="url" required placeholder="https://…" />
            <Submit pending="Adding…">Add</Submit>
          </div>
        </form>
        <form action={prepareBestAction} className="card stack" style={{ margin: 0 }}>
          <div>
            <h3>Prepare several at once</h3>
            <p className="small muted" style={{ margin: 0 }}>Drafts the best matches you haven&apos;t looked at. Nothing is sent until you approve each one.</p>
          </div>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <input name="count" type="number" min={1} max={25} defaultValue={5} style={{ width: 80 }} aria-label="How many" />
            <Submit pending="Starting…">Prepare the best</Submit>
          </div>
        </form>
      </div>
      <form className="row" style={{ margin: "28px 0 8px" }}>
        <input name="q" type="search" placeholder="Search title, company or place" defaultValue={q} style={{ maxWidth: 320 }} />
        <select name="sort" defaultValue={sort ?? ""} style={{ width: 150 }}>
          <option value="">Best match</option>
          <option value="new">Newest</option>
        </select>
        <label className="inline">
          <input type="checkbox" name="auto" value="1" defaultChecked={Boolean(auto)} /> Only ones the app can fill in
        </label>
        <label className="inline">
          <input type="checkbox" name="all" value="1" defaultChecked={Boolean(all)} /> Include hidden and low scores
        </label>
        <button type="submit">Filter</button>
      </form>
      <p className="small muted" style={{ margin: "0 0 4px" }}>{matching.length.toLocaleString()} shown</p>
      {jobs.length === 0 && <p className="muted">Nothing to show yet. Search for internships, or lower the minimum score on your profile.</p>}
      {jobs.map((j) => {
        const app = appByJob.get(j.id);
        const isNew = j.firstSeenAt && db.settings.lastSearchAt && j.firstSeenAt === db.settings.lastSearchAt;
        return (
          <div className="card job spread" key={j.id}>
            <div className="job-main">
              <div>
                {isNew && <span className="chip new">New</span>}
                <span className="company">{j.company}</span>
              </div>
              <div className="title">{j.title}</div>
              <div className="meta">
                {j.location || "Location not stated"} · posted {j.postedAt.slice(0, 10)} ·{" "}
                {j.source === "external" ? "you apply on their site" : "the app can fill this in"}
              </div>
              <div>
                <span className="chip source">{FROM[j.via]}</span>
                {j.reasons?.map((r) => <span className="chip" key={r}>{r}</span>)}
              </div>
              <div className="row small" style={{ marginTop: 10, gap: 16 }}>
                <a href={j.url} target="_blank" rel="noreferrer">Read the posting</a>
                <form action={hideJob}>
                  <input type="hidden" name="jobId" value={j.id} />
                  <button className="link">{j.hidden ? "Unhide" : "Not interested"}</button>
                </form>
              </div>
            </div>
            <div className="row">
              <Score value={j.score} />
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
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Link className="button" href={`/jobs?${more.toString()}`}>Show more ({(matching.length - jobs.length).toLocaleString()} left)</Link>
        </div>
      )}
    </>
  );
}
