import Link from "next/link";
import { notFound } from "next/navigation";
import { markSubmitted, saveApplication, saveOutcome } from "@/app/actions";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Flash } from "@/components/Flash";
import { recoverInterrupted } from "@/lib/applications";
import { OUTCOME_LABEL, STATUS_LABEL } from "@/lib/labels";
import { readDb } from "@/lib/store";
import type { FormField } from "@/lib/types";

export const dynamic = "force-dynamic";

const SOURCE_TAG: Record<FormField["source"], string> = {
  profile: "from your profile",
  ai: "drafted by Claude, please check",
  you: "your answer",
  empty: "",
};

function Field({ f, hasCv }: { f: FormField; hasCv: boolean }) {
  const name = `f:${f.key}`;
  const id = `f-${f.key}`;
  let input: React.ReactNode;
  if (f.type === "file") {
    input = (
      <div className="small">
        {f.value === "resume" ? (hasCv ? "Your CV will be attached." : "Upload your CV on the Profile page.") : f.value === "cover_letter" ? "The cover letter below will be attached." : "Nothing will be attached."}
        <input type="hidden" name={name} value={f.value} />
      </div>
    );
  } else if (f.type === "select" && f.options) {
    input = (
      <select id={id} name={name} defaultValue={f.value}>
        <option value="">Choose…</option>
        {f.options.map((o) => (
          <option key={o.value} value={o.label}>{o.label}</option>
        ))}
      </select>
    );
  } else if (f.type === "multiselect" && f.options) {
    const chosen = new Set(f.value.split("\n"));
    input = (
      <div>
        {f.options.map((o) => (
          <label key={o.value} className="inline" style={{ marginRight: 14 }}>
            <input type="checkbox" name={name} value={o.label} defaultChecked={chosen.has(o.label)} /> {o.label}
          </label>
        ))}
      </div>
    );
  } else if (f.type === "textarea" || f.value.length > 120) {
    input = <textarea id={id} name={name} defaultValue={f.value} />;
  } else {
    input = <input id={id} name={name} defaultValue={f.value} />;
  }
  return (
    <div className="field">
      <label htmlFor={id}>
        {f.label} {f.required && <span className="req">*</span>}
        {SOURCE_TAG[f.source] && <span className="tag">{SOURCE_TAG[f.source]}</span>}
      </label>
      {input}
      {f.note && <div className="note">{f.note}</div>}
    </div>
  );
}

export default async function ApplicationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> }) {
  const [{ id }, { msg }] = await Promise.all([params, searchParams]);
  await recoverInterrupted();
  const db = await readDb();
  const app = db.applications.find((a) => a.id === id);
  if (!app) notFound();
  const job = db.jobs.find((j) => j.id === app.jobId);
  const missing = app.fields.filter((f) => f.required && !f.value.trim());
  const locked = app.status === "sending" || app.status === "submitted";

  return (
    <>
      <AutoRefresh active={app.status === "sending"} />
      <Link href="/applications" className="small">← Applications</Link>
      <div className="spread">
        <div>
          <h1>{job?.title ?? "Closed posting"}</h1>
          <p className="lead">
            {job?.company} · {job?.location} · <a href={job?.url} target="_blank" rel="noreferrer">posting</a> ·{" "}
            <a href={job?.applyUrl} target="_blank" rel="noreferrer">application page</a>
          </p>
        </div>
        <strong className={`status-${app.status}`}>{STATUS_LABEL[app.status]}</strong>
      </div>
      <Flash msg={msg} />

      {app.status === "submitted" && (
        <form action={saveOutcome} className="card">
          <input type="hidden" name="id" value={app.id} />
          <div className="row">
            <strong>What happened next?</strong>
            <select name="outcome" defaultValue={app.outcome ?? "waiting"} style={{ maxWidth: 240 }}>
              {Object.entries(OUTCOME_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <label htmlFor="notes" style={{ marginTop: 8 }}>Notes (interview dates, contacts)</label>
          <textarea id="notes" name="notes" defaultValue={app.notes ?? ""} />
          <button style={{ marginTop: 8 }}>Save</button>
        </form>
      )}

      {app.status === "needs_you" && (
        <div className="card">
          <strong>This one needs you.</strong> The site wanted something the app could not do on its own (often a captcha or an unusual question).
          Open the <a href={job?.applyUrl} target="_blank" rel="noreferrer">application page</a>, copy the answers below, and submit it yourself, or press
          &ldquo;Approve and send&rdquo; again to retry with the browser window open.
          <form action={markSubmitted} style={{ marginTop: 8 }}>
            <input type="hidden" name="id" value={app.id} />
            <button>I submitted it myself</button>
          </form>
        </div>
      )}

      {app.fields.length === 0 ? (
        <p className="muted">You applied to this one on the company&apos;s own site.</p>
      ) : (
      <form action={saveApplication}>
        <input type="hidden" name="id" value={app.id} />
        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="card">
            <strong>Application form</strong>
            <p className="small muted">These are the questions on the real form. Required ones are marked *.</p>
            {app.fields.map((f) => (
              <Field key={f.key} f={f} hasCv={Boolean(db.profile.cv)} />
            ))}
          </div>
          <div className="card">
            <label htmlFor="coverLetter">Cover letter</label>
            <textarea id="coverLetter" name="coverLetter" defaultValue={app.coverLetter} style={{ minHeight: 260 }} />
          </div>
          <div className="row">
            <button type="submit" name="intent" value="send" className="primary">
              {db.settings.rehearsal ? "Rehearse (fill without submitting)" : "Approve and send"}
            </button>
            <button type="submit" name="intent" value="save">Save changes</button>
            <button type="submit" name="intent" value="skip">Skip this one</button>
          </div>
          {missing.length > 0 && (
            <p className="small" style={{ color: "var(--warn)" }}>
              {missing.length} required answer{missing.length === 1 ? " is" : "s are"} empty: {missing.map((f) => f.label).join("; ")}. The form will likely be rejected until you fill {missing.length === 1 ? "it" : "them"}.
            </p>
          )}
        </fieldset>
      </form>
      )}
      {app.status === "submitted" && (
        <form action={saveApplication}>
          <input type="hidden" name="id" value={app.id} />
          <button type="submit" name="intent" value="reopen" className="link small">Mark as not sent</button>
        </form>
      )}

      {app.log.length > 0 && (
        <>
          <h2>What happened</h2>
          <pre className="log">{app.log.join("\n")}</pre>
        </>
      )}
      {app.screenshot && (
        <>
          <h2>Last screenshot of the form</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="shot" src={`/screens/${app.screenshot}?v=${encodeURIComponent(app.updatedAt)}`} alt="The application form as the app left it" />
        </>
      )}
    </>
  );
}
