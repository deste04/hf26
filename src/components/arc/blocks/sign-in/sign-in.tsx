"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "../../button/button";
import { motionTokens } from "../../lib/motion-tokens";
import styles from "./sign-in.module.css";

// Arc's sign-in block, cut down to the one method this app has: GitHub OAuth. The email code, passkey, other
// providers and the signed-in step are gone; once signed in, the account lives in the header's avatar menu.

export interface SignInProps {
  /** Shown under the button when the last attempt did not finish. */
  error?: string;
  /** Path to return to after signing in; without one, GitHub sends the person to their profile. */
  next?: string;
}

const githubMark = "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12";

export function SignIn({ error, next }: SignInProps) {
  const reduce = !!useReducedMotion();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  function signInWithGithub() {
    if (busy) return;
    setBusy(true);
    setStatus("Opening GitHub");
    window.location.assign(next ? `/api/auth/login?next=${encodeURIComponent(next)}` : "/api/auth/login");
  }

  return (
    <section className={styles.signIn} aria-label="Sign in">
      <div className={styles.step}>
        <div className={styles.heading}><h2>Sign in to Vouch Explorer</h2><p>Use your GitHub account. The app only reads your public profile.</p></div>
        <Button type="button" className={styles.wide} loading={busy} onClick={signInWithGithub}>
          <svg className={styles.providerMark} width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={githubMark} /></svg>
          Continue with GitHub
        </Button>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>

      <footer className={styles.footer}>
        <p className={styles.srOnly} role="status" aria-live="polite">{status}</p>
        <span className={styles.status} aria-hidden="true">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={status} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: `blur(${motionTokens.blur.soft}px)` }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -4, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.fast } }} transition={reduce ? { duration: motionTokens.duration.instant } : { duration: motionTokens.duration.standard, ease: motionTokens.ease.enter }}>{status}</motion.span>
          </AnimatePresence>
        </span>
        <span className={styles.switch}>No account? <a className={styles.textButton} href="https://github.com/signup" target="_blank" rel="noreferrer">Join GitHub</a></span>
      </footer>
    </section>
  );
}

export default SignIn;
