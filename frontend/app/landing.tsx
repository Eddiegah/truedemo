"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Real output, not a mockup: generated live by TrueDemo's own script_writer.py
// against Gemini, grounded in this repo's actual code (Next.js 16, Vercel,
// GitHub Actions, Playwright, Piper). Reproducible from worker/src/script_writer.py.
const REAL_NARRATION = [
  "Welcome to TrueDemo, an AI demo video tool built with Next.js 16 and deployed on Vercel.",
  "Navigating to the video generator opens the workflow where Playwright browser automation and Gemini LLM context extraction prepare your repository for video creation.",
];

const GENERIC_NARRATION = [
  "Welcome to this powerful, intuitive platform designed to streamline your workflow.",
  "With just a few clicks, you can unlock a seamless, modern experience built for productivity.",
];

export function Landing() {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center"
      >
        <Badge variant="outline" className="mb-4 text-muted-foreground">
          Autonomous demo videos, grounded in your actual code
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Every other tool guesses what your product does.
          <br />
          <span className="text-primary">TrueDemo reads your code and gets it right.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-balance text-muted-foreground">
          Paste a live app URL and its GitHub repo. An autonomous agent explores your app in a
          real browser, grounds itself in your actual source, and produces a narrated demo video
          that&apos;s technically accurate - not marketing fluff.
        </p>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="mt-16"
      >
        <h2 className="text-center text-sm font-medium tracking-wide text-muted-foreground uppercase">
          See the difference
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">
                What a UI-only tool would say
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {GENERIC_NARRATION.map((line) => (
                <p key={line} className="text-sm text-muted-foreground italic">
                  &ldquo;{line}&rdquo;
                </p>
              ))}
              <p className="pt-2 text-xs text-muted-foreground/70">
                Illustrative example of generic, UI-only narration - the pattern this product
                exists to avoid.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-primary/[0.03]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-primary">
                What TrueDemo actually said
                <Badge className="h-4 px-1.5 text-[10px]">real output</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {REAL_NARRATION.map((line) => (
                <p key={line} className="text-sm text-foreground/90">
                  &ldquo;{line}&rdquo;
                </p>
              ))}
              <p className="pt-2 text-xs text-muted-foreground">
                Generated live by this repo&apos;s own <code>script_writer.py</code> against
                Gemini, grounded in its real dependencies and file structure - not written by a
                person for this page.
              </p>
            </CardContent>
          </Card>
        </div>
      </motion.section>
    </>
  );
}
