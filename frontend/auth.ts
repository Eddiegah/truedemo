import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [GitHub],
  session: { strategy: "database" },
  callbacks: {
    // next-auth's default session doesn't include the user id - the video
    // library and job ownership both need it, so it's added explicitly here.
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});
