import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Landing } from "./landing";

const PIPELINE_STEPS = [
  {
    title: "Explore",
    body: "A real headless browser navigates your live app - same-origin only, loop-safe, screenshotting every step.",
  },
  {
    title: "Ground",
    body: "Your GitHub repo is cloned and read: README, dependency manifests, file tree - including monorepo subdirectories.",
  },
  {
    title: "Narrate",
    body: "Gemini writes narration from that real context, not from guessing at your UI.",
  },
  {
    title: "Assemble",
    body: "Piper TTS voices it, ffmpeg burns in captions and muxes audio, and the video publishes automatically.",
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-20">
      <Landing />

      <section className="mt-24">
        <h2 className="text-center text-sm font-medium tracking-wide text-muted-foreground uppercase">
          How it works
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {PIPELINE_STEPS.map((step, i) => (
            <Card key={step.title}>
              <CardContent className="flex gap-4">
                <span className="font-mono text-sm text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-medium">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Honest status:</span> the generation
          pipeline above is real and has been run end to end in production - not a mockup. What
          isn&apos;t built yet: accounts, a saved video library, and sharing. See the{" "}
          <a
            href="https://github.com/Eddiegah/truedemo#verification"
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            README&apos;s verification section
          </a>{" "}
          for the actual proof, including real bugs found and fixed along the way.
        </p>
      </section>

      <div className="mt-16 flex flex-col items-center gap-3 text-center">
        <Badge variant="outline" className="text-muted-foreground">
          Free to try - no account required yet
        </Badge>
        <Button size="lg" nativeButton={false} render={<Link href="/generate" />}>
          Generate a demo video →
        </Button>
      </div>
    </main>
  );
}
