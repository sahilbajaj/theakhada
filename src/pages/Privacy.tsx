import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

const CONTACT_EMAIL = "privacy@theakhada.app";
const EFFECTIVE_DATE = "August 25, 2026";

export default function Privacy() {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-2xl content-start gap-6 bg-background px-4 py-8 text-foreground">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>

      <article className="prose prose-sm max-w-none dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Effective {EFFECTIVE_DATE}</p>

        <p>
          The Akhada ("we", "us") operates a private club-operations application at theakhada.app.
          This Privacy Policy describes what personal information we collect from members of the club,
          how we use it, who can see it, and the choices you have. Contact us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with any questions.
        </p>

        <h2>1. Information we collect</h2>
        <ul>
          <li>
            <strong>Account information</strong>: your email address, full name, and (optionally) a
            nickname and avatar image URL that you or a club admin provides.
          </li>
          <li>
            <strong>Google Sign-In data</strong>: if you sign in with Google, we receive your Google
            account email, name, and profile picture URL via OAuth. We do not receive your Google
            password. We do not access any other Google service or Google Drive content.
          </li>
          <li>
            <strong>Club activity</strong>: matches you record (opponents, scores, timestamps, edits),
            attendance you or coaches record, and match-related notifications.
          </li>
          <li>
            <strong>Membership metadata</strong>: your role in the club (owner / admin / coach / player /
            guest), your rating, and your seeding rank.
          </li>
          <li>
            <strong>Technical logs</strong>: our hosting providers (Supabase, AWS Amplify) collect
            standard request logs (IP address, user agent, timestamps) for security and reliability.
          </li>
        </ul>

        <h2>2. How we use it</h2>
        <ul>
          <li>Authenticate you and grant access to your club.</li>
          <li>Show accurate stats, rankings, seeding, and match history to you and other club members.</li>
          <li>Notify you of matches and admin actions that involve you.</li>
          <li>Protect the service from abuse and troubleshoot problems.</li>
        </ul>
        <p>We do not use your data for advertising and we do not sell it.</p>

        <h2>3. Who can see it</h2>
        <ul>
          <li>
            <strong>Other club members</strong> can see your name, avatar, rating, seeding, and match
            history within the club.
          </li>
          <li>
            <strong>Club owners and admins</strong> additionally control your role, rating, and
            membership status.
          </li>
          <li>
            <strong>Service providers</strong> that we rely on to run the app: Supabase (database and
            auth) and AWS Amplify (hosting). They process your data on our behalf under their own
            security terms.
          </li>
          <li>
            <strong>Legal requirements</strong>: we may disclose information if required by law.
          </li>
        </ul>

        <h2>4. Where your data lives and how long we keep it</h2>
        <p>
          Data is stored in a Supabase-managed Postgres database. We keep account and match data for as
          long as you remain a member of the club. If your access is revoked, an admin may delete or
          anonymize your data on request. Request deletion by emailing{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will honor it within 30 days.
        </p>

        <h2>5. Your choices</h2>
        <ul>
          <li>Update your nickname and avatar from your profile settings.</li>
          <li>Ask a club admin to correct your name, email, or rating.</li>
          <li>Request access, correction, or deletion of your data by emailing{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</li>
          <li>Revoke Google Sign-In at any time from your Google Account permissions.</li>
        </ul>

        <h2>6. Children</h2>
        <p>
          The Akhada is intended for adult club members. If you are under the age of majority in your
          jurisdiction, please do not use the service.
        </p>

        <h2>7. Security</h2>
        <p>
          We rely on Supabase's row-level security to keep club data scoped to authorized members and
          on standard TLS for data in transit. No service is perfectly secure, but we work to keep the
          app up to date and access minimized.
        </p>

        <h2>8. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. Material changes will be communicated through
          the app. Continued use of the service after an update means you accept the revised policy.
        </p>

        <h2>9. Contact</h2>
        <p>
          Questions about this policy or your data: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </article>
    </main>
  );
}
