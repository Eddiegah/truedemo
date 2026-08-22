"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ShareActions({ videoUrl }: { videoUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={copyLink}>
        {copied ? "Copied!" : "Copy link"}
      </Button>
      <Button variant="outline" size="sm" render={<a href={videoUrl} download />}>
        Download
      </Button>
    </div>
  );
}
