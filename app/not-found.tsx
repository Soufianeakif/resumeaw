import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent font-mono text-base font-bold text-accent-foreground">
        ra
      </span>
      <div>
        <h1 className="text-xl font-semibold">Document not found</h1>
        <p className="mt-1 text-sm text-muted">
          It may have been deleted from the local database.
        </p>
      </div>
      <Link href="/" className="btn-primary">
        Back to documents
      </Link>
    </div>
  );
}
