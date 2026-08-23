import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: { job: { findUnique: vi.fn(), update: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const TEST_SECRET = "test-webhook-secret";

function makeRequest(secret: string | null = TEST_SECRET): NextRequest {
  const headers: Record<string, string> = {};
  if (secret !== null) headers["x-webhook-secret"] = secret;
  return new NextRequest("https://truedemo.test/api/jobs/job-1/credentials", { headers });
}

beforeEach(() => {
  process.env.WEBHOOK_SECRET = TEST_SECRET;
  vi.mocked(prisma.job.findUnique).mockReset();
  vi.mocked(prisma.job.update).mockReset();
});

describe("GET /api/jobs/[id]/credentials", () => {
  it("returns 401 with no secret, and never touches the database", async () => {
    const res = await GET(makeRequest(null), { params: Promise.resolve({ id: "job-1" }) });

    expect(res.status).toBe(401);
    expect(prisma.job.findUnique).not.toHaveBeenCalled();
  });

  it("returns 401 with the wrong secret", async () => {
    const res = await GET(makeRequest("wrong"), { params: Promise.resolve({ id: "job-1" }) });

    expect(res.status).toBe(401);
  });

  it("returns 404 when the job doesn't exist", async () => {
    vi.mocked(prisma.job.findUnique).mockResolvedValue(null);

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "missing" }) });

    expect(res.status).toBe(404);
  });

  it("returns the credentials and immediately nulls them out in the database", async () => {
    vi.mocked(prisma.job.findUnique).mockResolvedValue({
      demoUsername: "demo@test.com",
      demoPassword: "secret123",
    } as never);
    vi.mocked(prisma.job.update).mockResolvedValue({} as never);

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "job-1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ demoUsername: "demo@test.com", demoPassword: "secret123" });
    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { demoUsername: null, demoPassword: null },
    });
  });

  it("doesn't touch the database again when credentials are already null", async () => {
    // No credentials were ever provided for this job - nothing to clear,
    // so no wasted write.
    vi.mocked(prisma.job.findUnique).mockResolvedValue({
      demoUsername: null,
      demoPassword: null,
    } as never);

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "job-1" }) });

    expect(res.status).toBe(200);
    expect(prisma.job.update).not.toHaveBeenCalled();
  });
});
