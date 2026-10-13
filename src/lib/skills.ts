import { normalise } from "./text";

/** Skills the app knows how to spot in a CV, a LinkedIn export, GitHub repos and job descriptions. */
export const KNOWN_SKILLS = [
  "Python", "Java", "JavaScript", "TypeScript", "C", "C++", "C#", "Go", "Rust", "Kotlin", "Swift", "Ruby", "PHP", "Scala", "R", "MATLAB", "SQL", "Bash",
  "React", "React Native", "Next.js", "Node.js", "Express", "Vue", "Angular", "Svelte", "HTML", "CSS", "Tailwind", "Django", "Flask", "FastAPI", "Spring", "Rails", ".NET",
  "Expo", "Flutter", "Android", "iOS",
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "SQLite", "Firebase", "Supabase", "GraphQL", "REST",
  "AWS", "GCP", "Azure", "Docker", "Kubernetes", "Terraform", "Linux", "Git", "CI/CD",
  "Machine Learning", "Deep Learning", "PyTorch", "TensorFlow", "scikit-learn", "Pandas", "NumPy", "NLP", "Computer Vision", "LLM", "Data Analysis", "Statistics", "Spark", "Tableau", "Excel",
  "Figma", "Product Management", "Agile",
] as const;

const PATTERNS = KNOWN_SKILLS.map((skill) => {
  const n = normalise(skill).replace(/[.+#]/g, (c) => `\\${c}`);
  // Single letters like "C" and "R" only count when written as a standalone word in the original casing.
  const strict = skill.length <= 2;
  return { skill, re: new RegExp(`(^|[^a-z0-9+#])${n}($|[^a-z0-9+#])`), strict };
});

export function extractSkills(text: string): string[] {
  const n = ` ${normalise(text)} `;
  const found: string[] = [];
  for (const { skill, re, strict } of PATTERNS) {
    if (strict) {
      if (new RegExp(`(^|[\\s,(/])${skill.replace(/[+#]/g, (c) => `\\${c}`)}($|[\\s,.;:)/])`).test(text)) found.push(skill);
    } else if (re.test(n)) {
      found.push(skill);
    }
  }
  return found;
}

export function mergeSkills(...lists: string[][]): string[] {
  const seen = new Map<string, string>();
  for (const list of lists) for (const s of list) {
    const k = s.trim().toLowerCase();
    if (k && !seen.has(k)) seen.set(k, s.trim());
  }
  return [...seen.values()];
}
