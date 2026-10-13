import Link from "next/link";
import { prepareAction, practiceRun } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { Score } from "@/components/Score";
import { Submit } from "@/components/Submit";
import { aiAvailable } from "@/lib/ai";
import { readDb } from "@/lib/store";
import { browserInstalled } from "@/lib/submit";

export const dynamic = "force-dynamic";

export default async function Overview({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const db = await readDb();
  const p = db.profile;
  const count = (s: string) => db.applications.filter((a) => a.status === s).length;
  const top = db.jobs
    .filter((j) => !j.hidden && !db.applications.some((a) => a.jobId === j.id))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 6);

  const steps = [
    { done: Boolean(p.cv), text: <>Upload your CV on the <Link href="/profile">Profile</Link> page.</> },
    { done: Boolean(p.github || p.linkedinText), text: <>Import your GitHub projects and your LinkedIn profile PDF.</> },
    { done: Boolean(p.answers.workAuthorized && p.answers.needsSponsorship), text: <>Answer the standard questions (work authorisation, sponsorship, start date).</> },
    { done: db.jobs.length > 0, text: <>Search for <Link href="/jobs">internships</Link>.</> },
    { done: db.applications.length > 0, text: <>Prepare an application, check it, and approve it to send.</> },
  ];

  const stats = [
    { label: "Drafts to review", value: count("draft"), tone: "" },
    { label: "Need you", value: count("needs_you"), tone: count("needs_you") ? "attention" : "" },
    { label: "Sending", value: count("sending"), tone: "" },
    { label: "Submitted", value: count("submitted"), tone: count("submitted") ? "good" : "" },
  ];
  const interviewing = db.applications.filter((a) => a.outcome === "interview").length;
  const fillable = db.jobs.filter((j) => j.source !== "external").length;

  return (
    <>
      <Flash msg={msg} />
      {!browserInstalled() && (
        <div className="flash warn">
          The browser the app uses to fill in forms isn&apos;t installed yet. Stop the app, run <code>npm run browsers</code>, and start it again.
        </div>
      )}
      <section className="hero">
        <div>
          {db.jobs.length > 0 && <span className="pill">{db.jobs.length.toLocaleString()} openings found, {fillable.toLocaleString()} the app can fill in</span>}
          <h1>
            Apply to more. <mark>Type less</mark>.
          </h1>
          <p className="lead">
            The app finds internships on company job boards and trackers, fills each application from your profile, and sends it only after you approve it.
          </p>
          <ol className="steps">
            {steps.map((s, i) => (
              <li key={i} className={s.done ? "done" : ""}><span>{s.text}</span></li>
            ))}
          </ol>
          <form action={practiceRun} className="row">
            <Submit className="primary" pending="Filling the practice form…">Try it on a practice form</Submit>
            <Link className="button" href="/jobs">Browse internships</Link>
          </form>
          <p className="small muted">The practice form is served by the app itself, so nothing leaves your computer.</p>
          {!aiAvailable() && (
            <p className="small muted">
              Tailored cover letters and answers need an Anthropic API key in <code>.env.local</code>. Without it the app uses a template.
            </p>
          )}
        </div>
        <div className="panel">
          <div className="panel-head">
            <span className="dot">Best matches you haven&apos;t applied to</span>
            <Link href="/jobs" className="small">See all</Link>
          </div>
          {top.length === 0 && <div className="panel-row muted">Search for internships to see your best matches here.</div>}
          {top.map((j) => (
            <div className="panel-row" key={j.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{j.company}</div>
                <div className="small muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.title}</div>
              </div>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <Score value={j.score} />
                {j.source === "external" ? (
                  <a className="button" href={j.applyUrl} target="_blank" rel="noreferrer">Apply on site</a>
                ) : (
                  <form action={prepareAction}>
                    <input type="hidden" name="jobId" value={j.id} />
                    <Submit className="primary" pending="Filling in…">Prepare</Submit>
                  </form>
                )}
              </div>
            </div>
          ))}
          <div className="panel-foot">
            Autopilot is{" "}
            {db.settings.autopilot.enabled
              ? `on, every ${db.settings.autopilot.everyHours} hours${db.settings.autopilot.autoSend ? ", sending drafts that qualify" : ", preparing drafts for you to approve"}`
              : "off"}
            . <Link href="/settings">Change it</Link>
            {interviewing > 0 && ` · ${interviewing} interviewing`}
          </div>
        </div>
      </section>

      <p className="eyebrow" style={{ marginTop: 40 }}>Your applications</p>
      <div className="grid">
        {stats.map((st) => (
          <Link href="/applications" className={`card stat ${st.tone}`} key={st.label} style={{ color: "inherit", textDecoration: "none" }}>
            <div className="label">{st.label}</div>
            <div className="num">{st.value}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
