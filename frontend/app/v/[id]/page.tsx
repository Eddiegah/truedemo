import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ShareActions } from "./share-actions";

interface Props {
  params: Promise<{ id: string }>;
}

async function getWatchableJob(id: string) {
  const job = await prisma.job.findUnique({ where: { id } });
  // A job that failed or hasn't finished yet has nothing worth sharing -
  // treated the same as "not found" on this public page, rather than
  // leaking its error message or in-progress state to anyone with the link.
  if (!job || job.status !== "completed" || !job.videoUrl) return null;
  return job;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const job = await getWatchableJob(id);
  if (!job) return { title: "Video not found — TrueDemo" };

  const title = `Demo of ${job.url} — TrueDemo`;
  return {
    title,
    description: `An autonomously generated, code-grounded demo video of ${job.url}.`,
    openGraph: { title, type: "video.other" },
    twitter: { card: "summary_large_image", title },
  };
}

export default async function WatchPage({ params }: Props) {
  const { id } = await params;
  const job = await getWatchableJob(id);

  if (!job) notFound();

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-16">
      <p className="text-sm text-muted-foreground">Demo of</p>
      <h1 className="mt-1 truncate text-2xl font-bold tracking-tight">{job.url}</h1>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        <video src={job.videoUrl!} controls preload="metadata" className="w-full" />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Generated autonomously by{" "}
          <Link href="/" className="text-primary hover:underline">
            TrueDemo
          </Link>{" "}
          on {new Date(job.createdAt).toLocaleDateString()}
        </p>
        <ShareActions videoUrl={job.videoUrl!} />
      </div>
    </main>
  );
}
