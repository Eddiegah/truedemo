"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className="relative py-1 text-muted-foreground transition-colors hover:text-foreground data-[active=true]:text-foreground"
      data-active={active}
    >
      {children}
      {active && (
        <motion.span
          layoutId="nav-underline"
          className="absolute right-0 -bottom-[13px] left-0 h-px bg-primary"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      )}
    </Link>
  );
}

export function Header() {
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-sm font-semibold tracking-tight transition-opacity hover:opacity-80">
          TrueDemo
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <NavLink href="/generate">Generate</NavLink>
          {session?.user && <NavLink href="/library">Library</NavLink>}

          {status === "loading" ? (
            <Skeleton className="h-7 w-24 rounded-lg" />
          ) : session?.user ? (
            <div className="flex items-center gap-2.5">
              {session.user.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt=""
                  className="h-6 w-6 rounded-full ring-1 ring-border"
                />
              )}
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button variant="outline" size="sm" onClick={() => signOut()}>
                  Sign out
                </Button>
              </motion.div>
            </div>
          ) : (
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button size="sm" onClick={() => signIn("github")}>
                Sign in with GitHub
              </Button>
            </motion.div>
          )}
        </nav>
      </div>
    </header>
  );
}
