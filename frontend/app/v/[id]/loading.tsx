import { Skeleton } from "@/components/ui/skeleton";

export default function WatchLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-16">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-2 h-8 w-2/3" />
      <Skeleton className="mt-6 aspect-video w-full rounded-xl" />
      <div className="mt-4 flex items-center justify-between">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-8 w-40 rounded-lg" />
      </div>
    </main>
  );
}
