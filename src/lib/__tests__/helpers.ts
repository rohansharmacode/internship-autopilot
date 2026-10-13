import { emptyProfile } from "../defaults";
import type { Profile } from "../types";

export function sampleProfile(): Profile {
  const p = emptyProfile();
  return {
    ...p,
    firstName: "Rohan",
    lastName: "Sharma",
    email: "rohan@example.com",
    phone: "+44 7700 900123",
    city: "London",
    country: "United Kingdom",
    school: "University College London",
    degree: "BSc",
    major: "Computer Science",
    graduationDate: "June 2027",
    linkedinUrl: "https://www.linkedin.com/in/rohan-example",
    githubUsername: "rohansharmacode",
    skills: ["TypeScript", "React", "Python", "SQL"],
    cv: { fileName: "cv.pdf", storedPath: "/tmp/cv.pdf", text: "CV text", uploadedAt: "2026-10-13" },
    answers: { ...p.answers, workAuthorized: "yes", needsSponsorship: "no", earliestStart: "June 2027" },
  };
}
