import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Internship Autopilot",
  description: "Finds internships, fills in applications from your profile, and sends each one after you approve it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <strong>Internship Autopilot</strong>
          <nav>
            <Link href="/">Overview</Link>
            <Link href="/profile">Profile</Link>
            <Link href="/jobs">Internships</Link>
            <Link href="/applications">Applications</Link>
            <Link href="/settings">Settings</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
