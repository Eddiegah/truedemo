"use client";

import { useEffect, useRef, useState } from "react";

interface ProgressEntry {
  stage: string;
  at: string;
}

interface Job {
  id: string;
  url: string;
  repoUrl: string | null;
  status: "queued" | "running" | "completed" | "failed";
  progressLog: ProgressEntry[];
  videoUrl: string | null;
  errorMessage: string | null;
}

const POLL_MS = 2500;

export default function Home() {
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
    setJob(null);
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
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-16">
      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Phase 1 — architecture proof, stub pipeline
      </div>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">TrueDemo</h1>
      <p className="mt-2 text-sm text-zinc-400">
        The only demo video tool that actually understands your code.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">App URL</label>
          <input
            required
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-app.vercel.app"
            className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">GitHub repo (optional, for code grounding)</label>
          <input
            type="url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/you/your-repo"
            className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Generate demo video"}
        </button>
        {error && <p className="rounded-lg bg-rose-950/60 px-3 py-2 text-sm text-rose-300">{error}</p>}
      </form>

      {job && (
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Job {job.id}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                job.status === "completed"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : job.status === "failed"
                  ? "bg-rose-500/15 text-rose-400"
                  : "bg-amber-500/15 text-amber-400"
              }`}
            >
              {job.status}
            </span>
          </div>
          <ul className="space-y-1.5">
            {job.progressLog.map((entry, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
                {entry.stage}
              </li>
            ))}
          </ul>
          {job.errorMessage && <p className="mt-3 rounded-lg bg-rose-950/60 px-3 py-2 text-sm text-rose-300">{job.errorMessage}</p>}
          {job.videoUrl && (
            <a href={job.videoUrl} target="_blank" className="mt-3 inline-block text-sm font-medium text-emerald-400 hover:text-emerald-300">
              View result →
            </a>
          )}
        </div>
      )}
    </main>
  );
}
