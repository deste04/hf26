import Link from "next/link";

export const metadata = { title: "Privacy · Vouch Explorer" };

const REPO = "https://github.com/deste04/hf26";

export default function PrivacyPage() {
  return (
    <div className="container legal">
      <h1 className="page-title">Privacy</h1>
      <p className="page-sub">Last updated 18 October 2026</p>

      <p>
        Vouch Explorer shows which open-source projects have vouched for or denounced a GitHub account, using the
        public <span className="mono">VOUCHED.td</span> files those projects publish. This page explains what data that
        involves, where it goes, and how to ask for a correction or removal.
      </p>

      <h2>What we read</h2>
      <ul>
        <li>
          <strong>Vouch lists.</strong> Public <span className="mono">VOUCHED.td</span> files in public GitHub
          repositories: the handles listed, whether each is vouched or denounced, and any note the project wrote.
        </li>
        <li>
          <strong>Who made each decision.</strong> The author of the commit that last changed a line, only when GitHub
          links that commit to an account. Otherwise it is shown as unknown.
        </li>
        <li>
          <strong>Public profile and activity.</strong> For a profile page: the GitHub login, name and avatar, and
          public pull requests, reviews and issues.
        </li>
      </ul>
      <p>
        We only read data that is already public on GitHub. We don&apos;t collect anything from other sources and we
        don&apos;t combine it with anything outside GitHub.
      </p>

      <h2>What we keep</h2>
      <p>
        There is no database. Data is read from GitHub when someone looks it up and cached in the server&apos;s memory
        for a few hours to a few days, so that repeat lookups don&apos;t hit GitHub&apos;s limits. AI summaries are kept
        in memory too, up to the 500 most recent. All of it is lost when the server restarts.
      </p>

      <h2>AI summaries</h2>
      <p>
        When a signed-in visitor opens a profile, the person&apos;s public pull requests, reviews and issues are sent
        to <a href="https://groq.com/privacy-policy/">Groq</a>, a model provider based in the United States, to write a
        short summary of their public work. The summary cites links to the original activity. It doesn&apos;t rate the
        person, and it doesn&apos;t recommend vouching for or denouncing them.
      </p>

      <h2>No scores, no automated decisions</h2>
      <p>
        Vouch Explorer doesn&apos;t compute a reputation score and doesn&apos;t vouch for, denounce, block or approve
        anyone. Every decision shown was made by a project&apos;s maintainers in their own repository. Whether to act on
        it is up to whoever is looking.
      </p>

      <h2>Signing in</h2>
      <p>
        You can sign in with GitHub. We ask for no extra permissions. After sign-in, your login, name, avatar address
        and GitHub access token are kept in an encrypted cookie in your browser for 30 days, or until you sign out. The
        token is only used to read public GitHub data on your behalf, so lookups count against your own GitHub limit
        instead of ours. It is never stored on the server.
      </p>

      <h2>Cookies and storage</h2>
      <ul>
        <li>
          <span className="mono">session</span>: keeps you signed in, as described above.
        </li>
        <li>
          <span className="mono">oauth_state</span>, <span className="mono">oauth_next</span>: used during sign-in,
          deleted after 10 minutes at most.
        </li>
        <li>
          <span className="mono">theme</span> in your browser&apos;s local storage: remembers light or dark mode.
        </li>
      </ul>
      <p>There are no analytics, ads or tracking cookies.</p>

      <h2>Why we process this data</h2>
      <p>
        Under the GDPR, our basis is legitimate interest (Article 6(1)(f)): helping maintainers see trust decisions
        that other projects have already made public, so they can judge contributions to their own projects. For
        signed-in visitors, it is also providing the sign-in you asked for.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask to see what Vouch Explorer shows about you, to have something corrected, to object, or to have your
        profile hidden. To do so, <a href={`${REPO}/issues/new`}>open an issue on our repository</a>. You don&apos;t
        need to give a reason.
      </p>
      <p>
        We can hide you from Vouch Explorer, but we can&apos;t change another project&apos;s{" "}
        <span className="mono">VOUCHED.td</span>. If you think a project vouched for or denounced you by mistake, ask
        that project&apos;s maintainers. Once their file changes, Vouch Explorer will show the change after its cache
        expires.
      </p>
      <p>
        If you live in the EU, you can also complain to your data protection authority. In Italy that is the{" "}
        <a href="https://www.garanteprivacy.it/">Garante per la protezione dei dati personali</a>.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes, we will update this page and the date at the top. See also the{" "}
        <Link href="/terms">terms of use</Link>.
      </p>
    </div>
  );
}
