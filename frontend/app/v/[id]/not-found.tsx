import Link from "next/link";

export default function VideoNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Video not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This video doesn&apos;t exist, or hasn&apos;t finished generating yet.
      </p>
      <Link href="/generate" className="mt-6 text-sm font-medium text-primary hover:underline">
        Generate your own →
      </Link>
    </main>
  );
}
