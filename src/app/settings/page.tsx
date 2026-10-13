import { addBoard, removeBoard, runAutopilotNow, saveAutopilot, saveSettings } from "@/app/actions";
import { AutoRefresh } from "@/components/AutoRefresh";
import { autopilotBusy } from "@/lib/autopilot";
import { Flash } from "@/components/Flash";
import { aiAvailable } from "@/lib/ai";
import { readDb } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const { settings: s } = await readDb();
  const a = s.autopilot;
  const busy = autopilotBusy();
  return (
    <>
      <AutoRefresh active={busy} />
      <h1>Settings</h1>
      <Flash msg={msg} />
      <form action={saveSettings} className="card">
        <label className="inline">
          <input type="checkbox" name="showBrowser" defaultChecked={s.showBrowser} /> Show the browser while it applies, so you can finish anything it can&apos;t (recommended)
        </label>
        <br />
        <label className="inline">
          <input type="checkbox" name="rehearsal" defaultChecked={s.rehearsal} /> Rehearsal mode: fill forms but never press Submit
        </label>
        <br />
        <label className="inline">
          <input type="checkbox" name="communityList" defaultChecked={s.communityList} /> Also search the{" "}
          <a href="https://github.com/SimplifyJobs/Summer2026-Internships" target="_blank" rel="noreferrer">SimplifyJobs internship list</a>{" "}
          (thousands of internships, updated daily)
        </label>
        <br />
        <label className="inline">
          <input type="checkbox" name="simplytkTracker" defaultChecked={s.simplytkTracker} /> Also search the{" "}
          <a href="https://simplytk.com/internship-tracker" target="_blank" rel="noreferrer">simplytk.com tracker</a>{" "}
          (UK internships, spring weeks and placements)
        </label>
        <div style={{ maxWidth: 220, marginTop: 12 }}>
          <label htmlFor="dailyLimit">Most applications to send per day</label>
          <input id="dailyLimit" name="dailyLimit" type="number" min={1} defaultValue={s.dailyLimit} />
        </div>
        <p className="small muted">
          Claude drafting: {aiAvailable() ? "on" : "off (add ANTHROPIC_API_KEY to .env.local and restart)"}.
        </p>
        <button className="primary">Save settings</button>
      </form>

      <h2>Autopilot</h2>
      <p className="small muted">
        While the app is running, autopilot searches for internships on a schedule and prepares drafts for the best new matches.
        It only sends on its own if you turn that on, and even then only applications where every required answer came from your
        profile or from an answer you wrote before. Anything Claude wrote waits for you.
      </p>
      <form action={saveAutopilot} className="card">
        <label className="inline">
          <input type="checkbox" name="enabled" defaultChecked={a.enabled} /> Search and prepare drafts every{" "}
          <input name="everyHours" type="number" min={1} max={48} defaultValue={a.everyHours} style={{ width: 70 }} /> hours, up to{" "}
          <input name="prepareCount" type="number" min={1} max={25} defaultValue={a.prepareCount} style={{ width: 70 }} /> drafts each time
        </label>
        <br />
        <label className="inline">
          <input type="checkbox" name="autoSend" defaultChecked={a.autoSend} /> Send qualifying drafts without asking when the match score is at least{" "}
          <input name="autoSendMinScore" type="number" min={0} max={100} defaultValue={a.autoSendMinScore} style={{ width: 70 }} />
        </label>
        <p className="small muted">
          The daily limit and rehearsal mode above still apply. Last run: {a.lastRunAt ? a.lastRunAt.slice(0, 16).replace("T", " ") : "never"}
          {busy ? " (running now)" : ""}.
        </p>
        <div className="row">
          <button className="primary">Save autopilot</button>
          <button formAction={runAutopilotNow} disabled={busy}>Run a round now</button>
        </div>
      </form>
      {a.log.length > 0 && <pre className="log">{[...a.log].reverse().join("\n")}</pre>}

      <h2>Company job boards</h2>
      <p className="small muted">
        The app searches these Greenhouse, Lever and Ashby boards. Paste any company&apos;s jobs link (for example
        https://jobs.lever.co/palantir or https://job-boards.greenhouse.io/figma) to add it.
      </p>
      <form action={addBoard} className="row card">
        <input name="board" placeholder="Jobs link or board name" style={{ flex: 1, minWidth: 220 }} required />
        <select name="source" defaultValue="greenhouse" style={{ width: 160 }}>
          <option value="greenhouse">Greenhouse</option>
          <option value="lever">Lever</option>
          <option value="ashby">Ashby</option>
        </select>
        <button>Add</button>
      </form>
      <div className="card">
        {s.boards.map((b) => (
          <form action={removeBoard} key={`${b.source}/${b.token}`} className="spread" style={{ padding: "4px 0" }}>
            <span>
              {b.token} <span className="muted small">{b.source}</span>
            </span>
            <input type="hidden" name="board" value={`${b.source}/${b.token}`} />
            <button className="link small">Remove</button>
          </form>
        ))}
      </div>
    </>
  );
}
