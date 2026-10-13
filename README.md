# Internship Autopilot

A web app that runs on your own computer. You give it your details once (CV, LinkedIn, GitHub and the
standard questions every application asks). Then it:

1. **Finds internships** on company job boards (Greenhouse, Lever and Ashby), in the
   [simplytk.com tracker](https://simplytk.com/internship-tracker) (UK internships, spring weeks, placements
   and off-cycle roles) and in the [SimplifyJobs community list](https://github.com/SimplifyJobs/Summer2026-Internships)
   (about 4,500 open internships, updated daily). You can also paste in any posting's link, for example one
   you found on Trackr. It ranks them against your skills, the title keywords you care about,
   where you want to work and, if you need a visa, whether the company sponsors.
2. **Prepares each application** from the employer's real form. Your profile fills the standard
   questions, and Claude drafts a cover letter and answers to the company's own questions. Claude only
   uses facts from your profile. When it can't answer something truthfully it leaves it blank for you.
   *Prepare* does one job; *Prepare the best N* drafts several in one go.
3. **Waits for your approval.** You read the filled-in form, edit anything, and press *Approve and send*.
   When you answer a company's own question, the app remembers it and reuses it the next time the same
   question comes up.
4. **Sends it** by opening the application page in a browser, filling every field, attaching your CV and
   pressing Submit. If the site shows a captcha or asks something the app couldn't fill, the window stays
   open so you can finish it yourself. The app never tries to get around a captcha.

Your data (profile, CV, applications, screenshots) stays in `data/` on your machine and is never committed.

## Running it

You need Node.js 20 or newer.

```bash
npm install
npm run browsers                     # downloads the Chromium the app drives
cp .env.example .env.local           # optional: add ANTHROPIC_API_KEY for tailored letters and answers
npm run dev                          # http://127.0.0.1:3000
```

The server only listens on 127.0.0.1, so nobody else on your network can open it.

Then:

1. **Profile**: upload your CV (PDF). The app reads your contact details and skills from it, and with an
   API key it fills in your education and summary too. Add your LinkedIn profile PDF (on LinkedIn: *More →
   Save to PDF*) and import your GitHub projects. Answer the standard questions and save.
2. **Internships**: press *Search for new internships*. Hide the ones you don't want.
3. Press *Prepare application* on one, check the answers, and press *Approve and send*.

After applying, set each application's outcome (interviewing, offer, rejected) and keep notes. *Download as
a spreadsheet* on the Applications page exports everything.

**Autopilot** (Settings, off by default) searches on a schedule while the app is running and prepares
drafts for the best new matches. If you also let it send, it only sends applications where every required
answer came from your profile or from an answer you wrote before. Anything Claude wrote, anything missing,
and anything below your chosen match score waits for you. The daily limit still applies.

To see it work before touching a real company, press **Try it on a practice form** on the Overview. The
app fills and submits a pretend application served by the app itself.

Turn on **Rehearsal mode** in Settings to watch it fill forms without ever pressing Submit. That's a
good way to try it first.

## Which sites it covers

| Site | Finds jobs | Applies | Notes |
| --- | --- | --- | --- |
| Greenhouse | Yes | Yes | Public job board API, full question list including custom questions. |
| Lever | Yes | Yes | Public postings API. Custom questions are read from the apply page. |
| Ashby | Yes | Yes | The app reads the live form, including Yes/No buttons, radio lists and checklists. |
| LinkedIn | No | No | Used only as a source for your profile. LinkedIn's terms forbid automated applying and accounts get restricted. |
| Workday and other company sites | Yes, via the community list | No | Listed with an *Apply on site* link; press *I applied* to track it. Each Workday site needs its own account. |
| simplytk.com tracker | Yes | Where the posting is on Greenhouse, Lever or Ashby | About 800 UK openings. Graduate jobs are left out. |
| Trackr | No | No | Its terms forbid pulling listings automatically. Paste a posting's Apply link into *Add one from a link* instead. |
| Indeed, Handshake, Glassdoor | No | No | Their terms forbid bots. |

Lots of companies hire interns through Greenhouse, Lever or Ashby. The app ships with a starter list
(Stripe, Figma, Databricks, Palantir, Ramp, OpenAI, Anthropic and more). You can add any company by
pasting its jobs link in Settings.

## Good to know

- Companies see every application, so a weak automated one does more harm than none. The daily limit
  (Settings, 15 by default) and the review step are there for that reason. Some companies also cap
  applications; Figma, for example, allows five in 30 days.
- Questions like "have you worked here before?" are answered "No" with a note asking you to check it.
  Voluntary equal-opportunity questions are left for you.
- After sending, each application keeps a log and a screenshot of the form as the app left it.
- The cover letter is attached as a PDF named after you and the company.
- If the app is closed while sending, that application is marked *Needs you* the next time you open it.

## Development

```bash
npm test          # unit tests, plus a browser test against a local fixture form
npm run lint
npm run typecheck
```

Set `PLAYWRIGHT_CHROMIUM_PATH` to use a Chromium that is already installed instead of `npm run browsers`.

Code layout:

- `src/lib/sources/`: fetch internships from each job board's public API and the community list.
- `src/lib/forms/`: load a job's real application form as a list of fields.
- `src/lib/fill.ts`: answer fields from your profile (pure, unit tested).
- `src/lib/match.ts`: score jobs against your profile (pure, unit tested).
- `src/lib/ai.ts`: Claude drafts the cover letter and open questions, and reads your CV.
- `src/lib/submit.ts`: Playwright fills and submits the employer's form.
- `src/app/`: the pages (Next.js App Router) and server actions.
