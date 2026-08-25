import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

const CONTACT_EMAIL = "privacy@theakhada.app";
const EFFECTIVE_DATE = "August 25, 2026";

export default function Terms() {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-2xl content-start gap-6 bg-background px-4 py-8 text-foreground">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>

      <article className="prose prose-sm max-w-none dark:prose-invert">
        <h1>Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Effective {EFFECTIVE_DATE}</p>

        <p>
          These Terms of Service ("Terms") govern your access to and use of The Akhada
          (the "Service"), a private club-operations application at theakhada.app. By signing in you
          agree to these Terms and to our{" "}
          <Link to="/privacy" className="underline">Privacy Policy</Link>. If you do not agree, do not
          use the Service.
        </p>

        <h2>1. Who can use the Service</h2>
        <p>
          Access is limited to members of a specific tennis club whose administrators have approved your
          account. You confirm that you are of the age of majority in your jurisdiction and that any
          information you provide is accurate.
        </p>

        <h2>2. Accounts</h2>
        <ul>
          <li>Keep your sign-in credentials confidential. Don't share your account or session with anyone.</li>
          <li>You are responsible for activity that happens under your account.</li>
          <li>Tell a club admin immediately if you suspect unauthorized use of your account.</li>
        </ul>

        <h2>3. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Access or modify data you are not authorized to see or change.</li>
          <li>Attempt to disrupt, probe, or reverse-engineer the Service beyond what is permitted by law.</li>
          <li>Record inaccurate or malicious content, including fake matches or defamatory names.</li>
          <li>Use the Service to violate the law or infringe someone else's rights.</li>
        </ul>

        <h2>4. Your content</h2>
        <p>
          You keep ownership of the content you enter (nicknames, avatar URLs, match records). By
          submitting content, you grant the club and the app's operators a non-exclusive, worldwide,
          royalty-free license to store, display, and process that content for the purpose of operating
          the Service.
        </p>

        <h2>5. Third-party services</h2>
        <p>
          The Service uses third-party providers, including Google Sign-In (for authentication),
          Supabase (database and auth backend), and AWS Amplify (hosting). Your use of those providers'
          features is also governed by their respective terms.
        </p>

        <h2>6. Availability and changes</h2>
        <p>
          We work to keep the Service available and accurate, but we do not guarantee uninterrupted
          access. We may update, add, or remove features at any time.
        </p>

        <h2>7. Suspension and termination</h2>
        <p>
          Club admins may suspend or revoke your access to the Service at any time, including for
          violation of these Terms. You may stop using the Service at any time; contact a club admin
          to remove your data (see the{" "}
          <Link to="/privacy" className="underline">Privacy Policy</Link>).
        </p>

        <h2>8. Disclaimers</h2>
        <p>
          The Service is provided "as is" and "as available" without warranties of any kind, whether
          express or implied, including warranties of merchantability, fitness for a particular
          purpose, and non-infringement.
        </p>

        <h2>9. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, the club and the app's operators are not liable for
          any indirect, incidental, special, consequential, or punitive damages, or for any loss of
          data, revenue, or goodwill, arising out of or related to your use of the Service.
        </p>

        <h2>10. Changes to these Terms</h2>
        <p>
          We may update these Terms from time to time. Material changes will be communicated through
          the app. Continued use of the Service after an update means you accept the revised Terms.
        </p>

        <h2>11. Contact</h2>
        <p>
          Questions about these Terms: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </article>
    </main>
  );
}
