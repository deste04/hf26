import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignIn } from "@/components/arc/blocks/sign-in/sign-in";
import { getSession, safeNext } from "@/server/session";

type Search = Promise<{ error?: string; next?: string }>;

const ERRORS: Record<string, string> = {
  denied: "GitHub sign-in was cancelled.",
  failed: "GitHub didn't confirm the sign-in. Try again.",
  setup: "GitHub sign-in isn't set up on this server yet.",
  limit: "This server has used up its GitHub requests. Sign in to keep going with your own account.",
};

export const metadata = { title: "Sign in · Vouch Explorer" };

/** Only the sign-in card. It reads the session cookie (someone signed in goes to their profile), so it streams in under Suspense. */
export default function LoginPage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="container login-page">
      <Suspense fallback={<SignIn />}>
        <LoginCard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function LoginCard({ searchParams }: { searchParams: Search }) {
  const [{ error, next }, session] = await Promise.all([searchParams, getSession()]);
  if (session) redirect(next ? safeNext(next) : `/u/${encodeURIComponent(session.login)}`);
  return <SignIn error={error ? ERRORS[error] ?? ERRORS.failed : undefined} next={next ? safeNext(next) : undefined} />;
}
