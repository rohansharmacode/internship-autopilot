import { addBoard, removeBoard, saveSettings } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { aiAvailable } from "@/lib/ai";
import { readDb } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const { settings: s } = await readDb();
  return (
    <>
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
        <div style={{ maxWidth: 220, marginTop: 12 }}>
          <label htmlFor="dailyLimit">Most applications to send per day</label>
          <input id="dailyLimit" name="dailyLimit" type="number" min={1} defaultValue={s.dailyLimit} />
        </div>
        <p className="small muted">
          Claude drafting: {aiAvailable() ? "on" : "off (add ANTHROPIC_API_KEY to .env.local and restart)"}.
        </p>
        <button className="primary">Save settings</button>
      </form>

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
