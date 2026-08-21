"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface LibraryJob {
  id: string;
  url: string;
  status: string;
  videoUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  queued: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  running: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  completed: "bg-primary/15 text-primary border-primary/20",
  failed: "bg-destructive/15 text-destructive border-destructive/20",
};

export function LibraryList({ jobs }: { jobs: LibraryJob[] }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
      className="mt-6 space-y-3"
    >
      {jobs.map((job) => (
        <motion.div
          key={job.id}
          variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
          transition={{ duration: 0.25 }}
          whileHover={{ y: -2 }}
        >
          <Card className="transition-colors hover:border-primary/40">
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
        </motion.div>
      ))}
    </motion.div>
  );
}
