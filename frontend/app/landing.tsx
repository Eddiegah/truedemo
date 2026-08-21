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

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

export function Landing() {
  return (
    <>
      <motion.div
        initial="hidden"
        animate="show"
        variants={stagger}
        className="text-center"
      >
        <motion.div variants={fadeUp} transition={{ duration: 0.4 }}>
          <Badge variant="outline" className="mb-4 text-muted-foreground">
            <motion.span
              className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-primary"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            Autonomous demo videos, grounded in your actual code
          </Badge>
        </motion.div>
        <motion.h1
          variants={fadeUp}
          transition={{ duration: 0.45 }}
          className="text-4xl font-bold tracking-tight text-balance sm:text-5xl"
        >
          Every other tool guesses what your product does.
          <br />
          <span className="bg-gradient-to-r from-primary to-emerald-300 bg-clip-text text-transparent">
            TrueDemo reads your code and gets it right.
          </span>
        </motion.h1>
        <motion.p
          variants={fadeUp}
          transition={{ duration: 0.45 }}
          className="mx-auto mt-5 max-w-xl text-balance text-muted-foreground"
        >
          Paste a live app URL and its GitHub repo. An autonomous agent explores your app in a
          real browser, grounds itself in your actual source, and produces a narrated demo video
          that&apos;s technically accurate - not marketing fluff.
        </motion.p>
      </motion.div>

      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        variants={stagger}
        className="mt-16"
      >
        <motion.h2
          variants={fadeUp}
          className="text-center text-sm font-medium tracking-wide text-muted-foreground uppercase"
        >
          See the difference
        </motion.h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <motion.div variants={fadeUp} whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
            <Card className="h-full border-border/60">
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
          </motion.div>

          <motion.div
            variants={fadeUp}
            whileHover={{ y: -3 }}
            transition={{ duration: 0.2 }}
            className="group"
          >
            <Card className="h-full border-primary/30 bg-primary/[0.03] transition-shadow group-hover:shadow-[0_0_40px_-12px_var(--primary)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm text-primary">
                  What TrueDemo actually said
                  <Badge className="h-4 px-1.5 text-[10px]">real output</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <motion.div
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true }}
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.25 } } }}
                  className="space-y-3"
                >
                  {REAL_NARRATION.map((line) => (
                    <motion.p
                      key={line}
                      variants={fadeUp}
                      transition={{ duration: 0.3 }}
                      className="text-sm text-foreground/90"
                    >
                      &ldquo;{line}&rdquo;
                    </motion.p>
                  ))}
                </motion.div>
                <p className="pt-2 text-xs text-muted-foreground">
                  Generated live by this repo&apos;s own <code>script_writer.py</code> against
                  Gemini, grounded in its real dependencies and file structure - not written by a
                  person for this page.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.section>
    </>
  );
}
