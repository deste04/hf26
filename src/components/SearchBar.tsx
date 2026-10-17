"use client";
import { Search, UserRound, Waypoints, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/arc/button/button";
import { cleanQuery } from "@/lib/query";

/**
 * Explore search: one bar that says what it understood (a person or a project) while you type.
 * Plain GET form underneath, so Map trust works before hydration; Show profile goes straight to /u/handle. "/" focuses it from anywhere on the page.
 */
export function SearchBar({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const q = cleanQuery(value);
  const kind = !q ? null : q.includes("/") ? "project" : "person";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      e.preventDefault();
      input.current?.focus();
      input.current?.select();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      className="search-bar"
      action="/"
      method="get"
      role="search"
      data-focused={focused || undefined}
      // Nothing to map yet: Enter in an empty field does nothing, like the disabled button.
      onSubmit={(e) => {
        if (!q) e.preventDefault();
      }}
    >
      <label htmlFor="q" className="sr-only">GitHub handle or project</label>
      <Search className="search-bar-icon" size={18} aria-hidden="true" />
      <input
        ref={input}
        id="q"
        name="q"
        type="search"
        className="search-bar-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => { if (e.key === "Escape" && value) { e.preventDefault(); setValue(""); } }}
        placeholder="@handle or owner/repo"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-describedby="q-kind"
      />
      <span id="q-kind" className="search-bar-kind" data-kind={kind ?? undefined} aria-live="polite">
        {kind === "project" ? "Project" : kind === "person" ? "Person" : ""}
      </span>
      {value ? (
        <button type="button" className="search-bar-clear" aria-label="Clear search" onClick={() => { setValue(""); input.current?.focus(); }}>
          <X size={16} aria-hidden="true" />
        </button>
      ) : (
        !focused && <kbd className="search-bar-kbd" aria-hidden="true">/</kbd>
      )}
      <div className="search-bar-actions">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push(`/u/${encodeURIComponent(q)}`)}
          disabled={kind !== "person"}
          title={kind === "project" ? "Profiles are for people; Map trust shows a project" : undefined}
        >
          <UserRound className="sb-icon is-profile" size={16} aria-hidden="true" />
          <span>Show profile</span>
        </Button>
        <Button type="submit" disabled={!q} title={q ? undefined : "Type a GitHub handle or owner/repo first"}>
          <Waypoints className="sb-icon is-map" size={16} aria-hidden="true" />
          <span>Map trust</span>
        </Button>
      </div>
    </form>
  );
}
