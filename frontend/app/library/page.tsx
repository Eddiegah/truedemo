import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_STYLES: Record<string, string> = {
  queued: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  running: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  completed: "bg-primary/15 text-primary border-primary/20",
  failed: "bg-destructive/15 text-destructive border-destructive/20",
};

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
        <div className="mt-6 space-y-3">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="truncate text-sm font-medium">{job.url}</CardTitle>
                <Badge className={`border ${STATUS_STYLES[job.status] ?? ""}`}>{job.status}</Badge>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{new Date(job.createdAt).toLocaleString()}</span>
                {job.videoUrl ? (
                  <a
                    href={job.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    Watch →
                  </a>
                ) : job.errorMessage ? (
                  <span className="text-destructive">{job.errorMessage}</span>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
