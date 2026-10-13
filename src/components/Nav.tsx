"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  jobs: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></>,
  apps: <><path d="M4 4h16v16H4z" /><path d="M4 14h4l2 3h4l2-3h4" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
};

const LINKS = [
  { href: "/", label: "Overview", icon: "home" },
  { href: "/jobs", label: "Internships", icon: "jobs" },
  { href: "/applications", label: "Applications", icon: "apps" },
  { href: "/profile", label: "Profile", icon: "profile" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

function Icon({ name }: { name: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

/** The top bar on wide screens and the tab bar along the bottom on phones. */
export function Nav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      <header className="top">
        <div className="inner">
          <Link href="/" className="brand">
            <span className="logo" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </span>
            <span>
              internship<span className="brand-accent">autopilot</span>
            </span>
          </Link>
          <nav className="desktop-nav" aria-label="Main">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={active(l.href) ? "active" : undefined} aria-current={active(l.href) ? "page" : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>
          <Link href="/jobs" className="button primary header-cta">Find internships</Link>
        </div>
      </header>
      <nav className="tabbar" aria-label="Main">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={active(l.href) ? "active" : undefined} aria-current={active(l.href) ? "page" : undefined}>
            <Icon name={l.icon} />
            <span>{l.label === "Applications" ? "Applied" : l.label === "Internships" ? "Jobs" : l.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
