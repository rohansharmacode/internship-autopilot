import { forgetAnswer, importGithubAction, saveProfile, uploadCv, uploadLinkedin } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { Submit } from "@/components/Submit";
import { readDb } from "@/lib/store";
import type { YesNo } from "@/lib/types";

export const dynamic = "force-dynamic";

function Text({ name, label, value, type = "text" }: { name: string; label: string; value: string; type?: string }) {
  return (
    <div>
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} defaultValue={value} />
    </div>
  );
}

function YesNoSelect({ name, label, value }: { name: string; label: string; value: YesNo }) {
  return (
    <div>
      <label htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={value}>
        <option value="">Not answered</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </div>
  );
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const { profile: p } = await readDb();
  return (
    <>
      <h1>Your profile</h1>
      <p className="lead">Everything here stays on this computer. The app fills applications from it.</p>
      <Flash msg={msg} />

      <div className="grid">
        <form action={uploadCv} className="card">
          <strong>CV</strong>
          <p className="small muted">{p.cv ? `${p.cv.fileName}, uploaded ${p.cv.uploadedAt.slice(0, 10)}` : "PDF or .txt. It is attached to every application."}</p>
          <input type="file" name="cv" accept=".pdf,.txt" required />
          <div style={{ marginTop: 8 }}>
            <Submit className="primary" pending="Reading…">Upload CV</Submit>
          </div>
        </form>
        <form action={uploadLinkedin} className="card">
          <strong>LinkedIn</strong>
          <p className="small muted">
            {p.linkedinText ? "LinkedIn profile added." : "On your LinkedIn profile choose More → Save to PDF, then upload that file here."}
          </p>
          <input type="file" name="linkedin" accept=".pdf,.txt" required />
          <div style={{ marginTop: 8 }}>
            <Submit pending="Reading…">Add LinkedIn PDF</Submit>
          </div>
        </form>
        <form action={importGithubAction} className="card">
          <strong>GitHub</strong>
          <p className="small muted">
            {p.github ? `${p.github.repos.length} projects imported; top languages ${p.github.languages.slice(0, 4).join(", ")}.` : "Imports your public repositories as projects and skills."}
          </p>
          <input name="githubUsername" placeholder="username" defaultValue={p.githubUsername} />
          <div style={{ marginTop: 8 }}>
            <Submit pending="Importing…">Import GitHub</Submit>
          </div>
        </form>
      </div>

      <form action={saveProfile}>
        <h2>About you</h2>
        <div className="card grid">
          <Text name="firstName" label="First name" value={p.firstName} />
          <Text name="lastName" label="Last name" value={p.lastName} />
          <Text name="email" label="Email" value={p.email} type="email" />
          <Text name="phone" label="Phone" value={p.phone} />
          <Text name="city" label="City" value={p.city} />
          <Text name="postalCode" label="Postcode / ZIP" value={p.postalCode} />
          <Text name="country" label="Country" value={p.country} />
          <Text name="linkedinUrl" label="LinkedIn URL" value={p.linkedinUrl} />
          <Text name="githubUsername" label="GitHub username" value={p.githubUsername} />
          <Text name="portfolioUrl" label="Website or portfolio" value={p.portfolioUrl} />
        </div>

        <h2>Education</h2>
        <div className="card grid">
          <Text name="school" label="University" value={p.school} />
          <Text name="degree" label="Degree (e.g. BSc)" value={p.degree} />
          <Text name="major" label="Subject" value={p.major} />
          <Text name="graduationDate" label="Graduation (e.g. May 2027)" value={p.graduationDate} />
          <Text name="gpa" label="GPA or grade (optional)" value={p.gpa} />
        </div>

        <h2>Skills and summary</h2>
        <div className="card">
          <label htmlFor="skills">Skills, separated by commas</label>
          <textarea id="skills" name="skills" defaultValue={p.skills.join(", ")} />
          <label htmlFor="languages" style={{ marginTop: 12 }}>Languages you speak, separated by commas</label>
          <input id="languages" name="languages" defaultValue={p.languages.join(", ")} />
          <label htmlFor="summary" style={{ marginTop: 12 }}>Two sentences about what you study and build</label>
          <textarea id="summary" name="summary" defaultValue={p.summary} />
        </div>

        <h2>Standard questions</h2>
        <p className="small muted">Most applications ask these. Answer once and the app reuses them.</p>
        <div className="card grid">
          <YesNoSelect name="workAuthorized" label="Authorised to work where you apply?" value={p.answers.workAuthorized} />
          <YesNoSelect name="needsSponsorship" label="Need visa sponsorship?" value={p.answers.needsSponsorship} />
          <YesNoSelect name="willingToRelocate" label="Willing to relocate?" value={p.answers.willingToRelocate} />
          <Text name="earliestStart" label="Earliest start date" value={p.answers.earliestStart} />
          <Text name="howDidYouHear" label="How did you hear about us?" value={p.answers.howDidYouHear} />
          <Text name="pronouns" label="Pronouns (optional)" value={p.answers.pronouns} />
        </div>

        <h2>What you&apos;re looking for</h2>
        <div className="card grid">
          <Text name="keywords" label="Title keywords (e.g. software, data, ML)" value={p.preferences.keywords.join(", ")} />
          <Text name="locations" label="Cities or countries" value={p.preferences.locations.join(", ")} />
          <Text name="minScore" label="Hide matches below this score" value={String(p.preferences.minScore)} type="number" />
          <div>
            <label>&nbsp;</label>
            <label className="inline">
              <input type="checkbox" name="remoteOk" defaultChecked={p.preferences.remoteOk} /> Remote is fine
            </label>
          </div>
        </div>
        <Submit className="primary" pending="Saving…">Save profile</Submit>
      </form>

      <h2>Answers the app remembers</h2>
      <p className="small muted">
        When you answer a company&apos;s own question, the app reuses your answer the next time the same question comes up. Questions that
        name a company are not reused.
      </p>
      {p.savedAnswers.length === 0 && <p className="small muted">Nothing saved yet.</p>}
      {p.savedAnswers.map((a) => (
        <form action={forgetAnswer} className="card" key={a.question}>
          <div className="spread">
            <strong>{a.question}</strong>
            <input type="hidden" name="question" value={a.question} />
            <button className="link small">Forget</button>
          </div>
          <div className="small" style={{ whiteSpace: "pre-wrap" }}>{a.answer}</div>
        </form>
      ))}
    </>
  );
}
