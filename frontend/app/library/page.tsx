import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LibraryList } from "./library-list";

export default async function LibraryPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Video library</h1>
        <p className="mt-3 text-sm text-muted-foreground">Sign in to see your generated videos.</p>
      </main>
    );
  }

  const jobs = await prisma.job.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Video library</h1>
        <Button size="sm" render={<Link href="/generate" />}>
          New video
        </Button>
      </div>

      {jobs.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No videos yet.{" "}
            <Link href="/generate" className="text-primary hover:underline">
              Generate your first one →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <LibraryList jobs={jobs.map((j) => ({ ...j, createdAt: j.createdAt.toISOString() }))} />
      )}
    </main>
  );
}
