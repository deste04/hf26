"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Button } from "@/components/arc/button/button";
import type { SessionUser } from "@/server/session";

/** Header account: "Sign in" when signed out; signed in, the avatar opens a menu with the account, the profile and sign out. */
export default function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const { data: me, isPending } = useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<SessionUser | null> => (await fetch("/api/auth/me")).json(),
  });

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const signOut = async () => {
    setLeaving(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      // A full reload drops every page the router cached while signed in.
      window.location.reload();
    } catch {
      setLeaving(false);
    }
  };

  if (isPending) return <span className="account-btn is-pending" aria-hidden="true" />;
  if (!me)
    return (
      // A plain link: a prefetched /login from while signed in would replay its redirect to the profile.
      <a href="/login" className="link-btn account-btn">
        Sign in
      </a>
    );
  const name = me.name || me.login;
  return (
    <div className="account" ref={box}>
      <button
        type="button"
        className="account-btn is-avatar"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Account, signed in as @${me.login}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar name={name} src={me.avatar} size="md" />
      </button>
      {open && (
        <div className="account-panel" role="dialog" aria-label="Account">
          <div className="account-id">
            <Avatar name={name} src={me.avatar} size="lg" />
            <div>
              <strong>{name}</strong>
              <span className="muted small">@{me.login}</span>
            </div>
          </div>
          <dl className="account-details">
            <div><dt>Signed in with</dt><dd>GitHub</dd></div>
            <div><dt>This browser</dt><dd>Remembered for 30 days</dd></div>
          </dl>
          <div className="account-actions">
            <Link className="link-btn" href={`/u/${encodeURIComponent(me.login)}`} onClick={() => setOpen(false)}>
              Open your profile
            </Link>
            <Button type="button" variant="danger" loading={leaving} onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
