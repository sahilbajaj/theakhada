import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

export default function Terms() {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-2xl content-start gap-6 bg-background px-4 py-8 text-foreground">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>

      <article className="prose prose-sm max-w-none dark:prose-invert">
        <h1>Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: 2026-08-25</p>

        <p>
          The Akhada is provided to members of a specific tennis club to help run day-to-day operations.
          By signing in, you agree to the following.
        </p>

        <h2>Use of the service</h2>
        <ul>
          <li>Only use the app if a club admin has approved your access.</li>
          <li>Record matches, scores, and other data accurately and in good faith.</li>
          <li>Don't share your sign-in link or session with others.</li>
          <li>Don't attempt to access or modify data you don't have permission for.</li>
        </ul>

        <h2>Content you provide</h2>
        <p>
          You keep ownership of the content you enter. By entering it into the app, you allow the club and
          its members to use it for the purposes described in the <Link to="/privacy" className="underline">Privacy Policy</Link>.
        </p>

        <h2>Availability</h2>
        <p>
          We try to keep the app running smoothly but make no formal uptime guarantees. Features and layouts
          may change without notice.
        </p>

        <h2>Termination</h2>
        <p>
          Club admins may revoke your access at any time. You can also stop using the app at any time; contact
          an admin to remove your data.
        </p>

        <h2>Liability</h2>
        <p>
          The app is provided as-is. To the fullest extent allowed by law, the club and the app's operators
          aren't liable for indirect or incidental damages arising from your use of the service.
        </p>

        <h2>Contact</h2>
        <p>
          Questions? Reach the club admins through the club's usual channels.
        </p>
      </article>
    </main>
  );
}
