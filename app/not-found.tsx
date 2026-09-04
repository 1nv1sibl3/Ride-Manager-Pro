import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
      <div className="text-5xl font-bold text-muted-2">404</div>
      <div className="text-sm text-muted">This page doesn&apos;t exist.</div>
      <Link href="/dashboard" className="btn btn-primary mt-2">
        Back to dashboard
      </Link>
    </div>
  );
}
