import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// GITHUB_REPO is read once into a module-level const on import, not
// per-call - found while writing these tests (the first version asserted
// a repo name set in beforeEach and failed, because by then the module
// had already captured whatever GITHUB_REPO was at import time). Testing
// that deliberately requires resetting the module registry and
// re-importing under a controlled env, not just setting process.env in
// beforeEach - real behavior, not a testing inconvenience to route around.
async function importDispatchJob(repoEnv: string | undefined) {
  vi.resetModules();
  if (repoEnv === undefined) {
    delete process.env.GITHUB_REPO;
  } else {
    process.env.GITHUB_REPO = repoEnv;
  }
  const mod = await import("./github");
  return mod.dispatchJob;
}

const originalFetch = global.fetch;
const originalToken = process.env.GH_DISPATCH_TOKEN;
const originalRepo = process.env.GITHUB_REPO;

beforeEach(() => {
  process.env.GH_DISPATCH_TOKEN = "test-token";
});

afterEach(() => {
  global.fetch = originalFetch;
  process.env.GH_DISPATCH_TOKEN = originalToken;
  if (originalRepo === undefined) delete process.env.GITHUB_REPO;
  else process.env.GITHUB_REPO = originalRepo;
});

describe("dispatchJob", () => {
  it("throws without ever calling fetch when GH_DISPATCH_TOKEN is missing", async () => {
    delete process.env.GH_DISPATCH_TOKEN;
    const fetchMock = vi.fn();
    global.fetch = fetchMock as never;
    const dispatchJob = await importDispatchJob("owner/repo");

    await expect(dispatchJob("job-1", "https://example.com", null)).rejects.toThrow(
      "GH_DISPATCH_TOKEN is not configured"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dispatches to the correct GitHub API URL, using the configured repo", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as never;
    const dispatchJob = await importDispatchJob("test-owner/test-repo");

    await dispatchJob("job-1", "https://example.com", "https://github.com/x/y");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://api.github.com/repos/test-owner/test-repo/actions/workflows/process-job.yml/dispatches"
    );
    expect(options.headers.Authorization).toBe("Bearer test-token");

    const body = JSON.parse(options.body);
    expect(body.ref).toBe("main");
    expect(body.inputs).toEqual({
      job_id: "job-1",
      url: "https://example.com",
      repo_url: "https://github.com/x/y",
    });
  });

  it("falls back to Eddiegah/truedemo when GITHUB_REPO isn't set", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as never;
    const dispatchJob = await importDispatchJob(undefined);

    await dispatchJob("job-1", "https://example.com", null);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/repos/Eddiegah/truedemo/");
  });

  it("sends an empty string for repo_url when none is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as never;
    const dispatchJob = await importDispatchJob("owner/repo");

    await dispatchJob("job-1", "https://example.com", null);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.inputs.repo_url).toBe("");
  });

  it("throws with the status and response body when GitHub returns a non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Workflow not found"),
    });
    global.fetch = fetchMock as never;
    const dispatchJob = await importDispatchJob("owner/repo");

    await expect(dispatchJob("job-1", "https://example.com", null)).rejects.toThrow(
      /GitHub workflow dispatch failed \(404\): Workflow not found/
    );
  });

  it("doesn't crash if reading the error response body itself fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.reject(new Error("body already consumed")),
    });
    global.fetch = fetchMock as never;
    const dispatchJob = await importDispatchJob("owner/repo");

    await expect(dispatchJob("job-1", "https://example.com", null)).rejects.toThrow(
      /GitHub workflow dispatch failed \(500\):/
    );
  });
});
