"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ProgressEntry {
  stage: string;
  at: string;
}

interface Job {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  progressLog: ProgressEntry[];
  videoUrl: string | null;
  errorMessage: string | null;
}

const POLL_MS = 2500;

// Shown instantly on submit, before the network round-trip resolves - this
// is what makes the response feel sub-100ms even though dispatching a real
// GitHub Actions run takes several seconds. Swapped for the real job once
// POST /api/jobs returns a jobId.
const OPTIMISTIC_JOB: Job = {
  id: "pending",
  status: "queued",
  progressLog: [{ stage: "Submitting job...", at: new Date().toISOString() }],
  videoUrl: null,
  errorMessage: null,
};

const STATUS_STYLES: Record<Job["status"], string> = {
  queued: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  running: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  completed: "bg-primary/15 text-primary border-primary/20",
  failed: "bg-destructive/15 text-destructive border-destructive/20",
};

export default function GeneratePage() {
  const { data: session, status } = useSession();
  const [url, setUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling(jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    const poll = async () => {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) return;
      const data: Job = await res.json();
      setJob(data);
      if (data.status === "completed" || data.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    };
    poll();
    pollRef.current = setInterval(poll, POLL_MS);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    setJob({ ...OPTIMISTIC_JOB, progressLog: [{ ...OPTIMISTIC_JOB.progressLog[0], at: new Date().toISOString() }] });
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, repoUrl: repoUrl || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to submit job.");
      startPolling(data.jobId);
    } catch (err) {
      setJob(null);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const isPending = job?.id === "pending";

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Badge variant="outline" className="mb-2 gap-2 border-border text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Real pipeline live
        </Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Generate a demo video</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Paste a live app URL and, optionally, its GitHub repo for technical grounding.
        </p>
      </motion.div>

      {status === "loading" ? null : !session?.user ? (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Sign in to generate a demo video - this keeps the free GitHub Actions pipeline from
              being abused by anonymous requests.
            </p>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Button onClick={() => signIn("github")}>Sign in with GitHub</Button>
            </motion.div>
          </CardContent>
        </Card>
      ) : (
      <Card className="mt-8">
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="url">App URL</Label>
              <Input
                id="url"
                required
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-app.vercel.app"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="repoUrl">GitHub repo (optional, for code grounding)</Label>
              <Input
                id="repoUrl"
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/you/your-repo"
              />
            </div>
            <motion.div whileHover={{ scale: submitting ? 1 : 1.02 }} whileTap={{ scale: submitting ? 1 : 0.98 }}>
              <Button type="submit" disabled={submitting} className="w-full" size="lg">
                {submitting ? "Submitting..." : "Generate demo video"}
              </Button>
            </motion.div>
            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
      )}

      <AnimatePresence mode="wait">
        {job && (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <Card
              className={`mt-6 transition-shadow ${
                job.status === "running" || job.status === "queued"
                  ? "shadow-[0_0_30px_-14px_var(--primary)]"
                  : ""
              }`}
            >
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="font-mono text-xs text-muted-foreground">
                  Job {job.id}
                </CardTitle>
                <Badge className={`gap-1.5 border ${STATUS_STYLES[job.status]}`}>
                  {(job.status === "running" || job.status === "queued") && (
                    <motion.span
                      className="h-1.5 w-1.5 rounded-full bg-current"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                  {job.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <AnimatePresence initial={false}>
                    {job.progressLog.map((entry, i) => (
                      <motion.li
                        key={`${entry.stage}-${i}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: i === job.progressLog.length - 1 ? 0 : 0 }}
                        className="flex items-start gap-2 text-sm text-foreground/90"
                      >
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                        {entry.stage}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>

                {isPending && (
                  <div className="mt-3 space-y-2">
                    <Skeleton className="h-3.5 w-4/5" />
                    <Skeleton className="h-3.5 w-3/5" />
                  </div>
                )}

                {job.errorMessage && (
                  <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {job.errorMessage}
                  </p>
                )}

                {job.videoUrl && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.3 }}
                  >
                    <motion.a
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      href={job.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-[0_0_24px_-8px_var(--primary)]"
                    >
                      Watch your video →
                    </motion.a>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
