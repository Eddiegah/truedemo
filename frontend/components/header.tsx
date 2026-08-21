"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function Header() {
  const { data: session, status } = useSession();

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          TrueDemo
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/generate" className="text-muted-foreground hover:text-foreground">
            Generate
          </Link>
          {session?.user && (
            <Link href="/library" className="text-muted-foreground hover:text-foreground">
              Library
            </Link>
          )}
          {status === "loading" ? null : session?.user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{session.user.name}</span>
              <Button variant="outline" size="sm" onClick={() => signOut()}>
                Sign out
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => signIn("github")}>
              Sign in with GitHub
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
