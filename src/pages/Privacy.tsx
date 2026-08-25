import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

export default function Privacy() {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-2xl content-start gap-6 bg-background px-4 py-8 text-foreground">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>

      <article className="prose prose-sm max-w-none dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: 2026-08-25</p>

        <p>
          The Akhada is a small operations app used by members of a tennis club. This page explains what we
          collect and why. Reach out to a club admin if anything is unclear.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>Account details you provide when signing up: email, full name, and optional nickname and avatar URL.</li>
          <li>Match data you record: opponents, scores, timestamps, and edits.</li>
          <li>Attendance and booking activity you or club coaches record on your behalf.</li>
          <li>Basic technical logs from our hosting providers (IP, user agent) for security and debugging.</li>
        </ul>

        <h2>Why we collect it</h2>
        <ul>
          <li>To let you sign in and use the club's features.</li>
          <li>To show accurate stats, rankings, and match history to you and other club members.</li>
          <li>To notify you about matches and admin actions relevant to you.</li>
        </ul>

        <h2>Who can see your data</h2>
        <ul>
          <li>Other members of your club can see your name, rating, seeding, avatar, and match history.</li>
          <li>Owners and admins can additionally see and edit your role and rating.</li>
          <li>We do not sell your data or share it with third parties for advertising.</li>
        </ul>

        <h2>Where it lives</h2>
        <p>
          Data is stored in a Supabase-managed Postgres database. Passwords and auth tokens are handled by
          Supabase; the app never sees your password directly.
        </p>

        <h2>Changes and deletion</h2>
        <p>
          You can update your nickname and avatar from your profile. To delete your account or match data,
          contact a club admin.
        </p>

        <h2>Contact</h2>
        <p>
          Questions? Reach the club admins through the club's usual channels.
        </p>
      </article>
    </main>
  );
}
