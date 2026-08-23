import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function LibraryLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-16">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardHeader className="flex-row items-center justify-between">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-14" />
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
