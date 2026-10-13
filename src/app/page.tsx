import Link from "next/link";
import { prepareAction, practiceRun } from "@/app/actions";
import { Flash } from "@/components/Flash";
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
    .slice(0, 5);

  const steps = [
    { done: Boolean(p.cv), text: <>Upload your CV on the <Link href="/profile">Profile</Link> page.</> },
    { done: Boolean(p.github || p.linkedinText), text: <>Import your GitHub projects and your LinkedIn profile PDF.</> },
    { done: Boolean(p.answers.workAuthorized && p.answers.needsSponsorship), text: <>Answer the standard questions (work authorisation, sponsorship, start date).</> },
    { done: db.jobs.length > 0, text: <>Search for <Link href="/jobs">internships</Link>.</> },
    { done: db.applications.length > 0, text: <>Prepare an application, check it, and approve it to send.</> },
  ];

  return (
    <>
      <h1>Overview</h1>
      <p className="lead">
        The app finds internships on company job boards, fills each application from your profile, and sends it only after you approve it.
      </p>
      <Flash msg={msg} />
      {!browserInstalled() && (
        <div className="flash">
          The browser the app uses to fill in forms isn&apos;t installed yet. Stop the app, run <code>npm run browsers</code>, and start it again.
        </div>
      )}
      <div className="card">
        <ol className="steps">
          {steps.map((s, i) => (
            <li key={i} className={s.done ? "done" : ""}>{s.text}</li>
          ))}
        </ol>
        <form action={practiceRun} className="row" style={{ marginTop: 8 }}>
          <Submit pending="Filling the practice form…">Try it on a practice form</Submit>
          <span className="small muted">Watch the app fill and submit a pretend application. Nothing leaves your computer.</span>
        </form>
        {!aiAvailable() && (
          <p className="small muted">
            Tailored cover letters and answers need an Anthropic API key in <code>.env.local</code>. Without it the app uses a template.
          </p>
        )}
      </div>
      <div className="grid">
        {[["Drafts to review", "draft"], ["Need you", "needs_you"], ["Sending", "sending"], ["Submitted", "submitted"]].map(([label, s]) => (
          <div className="card" key={s}>
            <div className="muted small">{label}</div>
            <div style={{ fontSize: 28, fontWeight: 600 }}>{count(s)}</div>
          </div>
        ))}
      </div>
      <p className="small muted">
        Autopilot is {db.settings.autopilot.enabled ? `on, every ${db.settings.autopilot.everyHours} hours${db.settings.autopilot.autoSend ? ", sending drafts that qualify" : ", preparing drafts for you to approve"}` : "off"}.{" "}
        <Link href="/settings">Change it</Link>.
        {" "}{db.applications.filter((a) => a.outcome === "interview").length > 0 && `${db.applications.filter((a) => a.outcome === "interview").length} interviewing.`}
      </p>
      {top.length > 0 && (
        <>
          <h2>Best matches you haven&apos;t applied to</h2>
          {top.map((j) => (
            <div className="card spread" key={j.id}>
              <div>
                <a href={j.url} target="_blank" rel="noreferrer" style={{ color: "inherit" }}><strong>{j.title}</strong></a> · {j.company}
                <div className="small muted">{j.location}</div>
              </div>
              <div className="row">
                <span className="score">{j.score}</span>
                {j.source === "external" ? (
                  <a className="button" href={j.applyUrl} target="_blank" rel="noreferrer">Apply on site</a>
                ) : (
                  <form action={prepareAction}>
                    <input type="hidden" name="jobId" value={j.id} />
                    <Submit pending="Filling in…">Prepare</Submit>
                  </form>
                )}
              </div>
            </div>
          ))}
          <Link href="/jobs">See all internships</Link>
        </>
      )}
    </>
  );
}
