import type { FormField } from "./types";

/** A local form that looks like a real one, so you can watch the app fill and submit without contacting anyone. */
export const PRACTICE_FIELDS: FormField[] = [
  { key: "first_name", label: "First Name", type: "text", required: true, value: "", source: "empty" },
  { key: "last_name", label: "Last Name", type: "text", required: true, value: "", source: "empty" },
  { key: "email", label: "Email", type: "text", required: true, value: "", source: "empty" },
  { key: "phone", label: "Phone", type: "text", required: false, value: "", source: "empty" },
  { key: "resume", label: "Resume/CV", type: "file", required: true, value: "", source: "empty" },
  { key: "linkedin", label: "LinkedIn Profile", type: "text", required: false, value: "", source: "empty" },
  { key: "github", label: "GitHub", type: "text", required: false, value: "", source: "empty" },
  { key: "school", label: "University", type: "text", required: true, value: "", source: "empty" },
  {
    key: "authorized",
    label: "Are you legally authorized to work in the country you are applying in?",
    type: "select",
    required: true,
    options: [{ label: "Yes", value: "Yes" }, { label: "No", value: "No" }],
    value: "",
    source: "empty",
  },
  {
    key: "sponsorship",
    label: "Will you require visa sponsorship?",
    type: "select",
    required: true,
    options: [{ label: "Yes", value: "Yes" }, { label: "No", value: "No" }],
    value: "",
    source: "empty",
  },
  { key: "why", label: "Why do you want to work at Practice Co?", type: "textarea", required: true, value: "", source: "empty" },
];

export const PRACTICE_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Practice Co – Software Engineering Intern</title>
<style>body{font:15px system-ui;max-width:640px;margin:32px auto;padding:0 16px}label{display:block;margin-top:14px;font-weight:600}input,select,textarea{width:100%;padding:8px;margin-top:4px}button{margin-top:20px;padding:10px 18px}</style></head>
<body>
<h1>Practice Co: Software Engineering Intern</h1>
<p>This is a practice form inside Internship Autopilot. Nothing here is sent anywhere.</p>
<form id="f">
<label for="first_name">First Name *</label><input id="first_name" name="first_name" required>
<label for="last_name">Last Name *</label><input id="last_name" name="last_name" required>
<label for="email">Email *</label><input id="email" name="email" type="email" required>
<label for="phone">Phone</label><input id="phone" name="phone">
<label for="resume">Resume/CV *</label><input id="resume" name="resume" type="file" required>
<label for="linkedin">LinkedIn Profile</label><input id="linkedin" name="linkedin">
<label for="github">GitHub</label><input id="github" name="github">
<label for="school">University *</label><input id="school" name="school" required>
<label for="authorized">Are you legally authorized to work in the country you are applying in? *</label>
<select id="authorized" name="authorized" required><option value="">Choose</option><option>Yes</option><option>No</option></select>
<fieldset><legend>Will you require visa sponsorship? *</legend>
<label><input type="radio" name="sponsorship" value="Yes" required> Yes</label>
<label><input type="radio" name="sponsorship" value="No"> No</label></fieldset>
<label for="why">Why do you want to work at Practice Co? *</label><textarea id="why" name="why" required></textarea>
<button type="submit">Submit application</button>
</form>
<script>
document.getElementById('f').addEventListener('submit', function (e) {
  e.preventDefault();
  if (!this.checkValidity()) { this.reportValidity(); return; }
  document.body.innerHTML = '<h1>Thank you for applying!</h1><p>That was only practice; nothing was sent.</p>';
});
</script>
</body></html>`;
