import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [GitHub],
  // JWT, not database, sessions - found by actually measuring, not
  // assuming: a database session strategy means every single useSession()
  // call and every server-side auth() call (which now includes the rate
  // limit check and the ownership check on GET /api/jobs/[id], both added
  // this session) round-trips to Postgres. Measured one such round-trip
  // at 7.2s on a Neon cold start - the same documented cold-start pattern
  // from this project's own Verification section, but hit on every page
  // load instead of a one-time setup hiccup. JWT sessions are validated
  // from a signed cookie with AUTH_SECRET, no DB call at all. The
  // PrismaAdapter is still used for account linking at sign-in.
  session: { strategy: "jwt" },
  callbacks: {
    // With JWT sessions, the user id has to be persisted into the token
    // at sign-in (jwt callback) then read back out per-request (session
    // callback) - there's no `user` object available on every session
    // check the way there was with the database strategy.
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) session.user.id = token.id as string;
      return session;
    },
  },
});
