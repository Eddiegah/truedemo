// Triggers the worker pipeline by dispatching a GitHub Actions workflow_dispatch
// event, rather than pushing to a Redis queue that a persistent worker polls -
// this is the free-tier substitution for Fly.io + Upstash: GitHub Actions
// itself provides the queueing/scheduling, at zero cost on a public repo.
const GITHUB_REPO = process.env.GITHUB_REPO ?? "Eddiegah/truedemo";
const WORKFLOW_FILE = "process-job.yml";

export async function dispatchJob(jobId: string, url: string, repoUrl: string | null): Promise<void> {
  const token = process.env.GH_DISPATCH_TOKEN;
  if (!token) {
    throw new Error("GH_DISPATCH_TOKEN is not configured - can't dispatch the worker.");
  }

  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ref: "main",
      inputs: {
        job_id: jobId,
        url,
        repo_url: repoUrl ?? "",
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub workflow dispatch failed (${res.status}): ${body}`);
  }
}
