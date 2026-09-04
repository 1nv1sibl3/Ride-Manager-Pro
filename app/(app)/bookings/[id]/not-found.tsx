import Link from "next/link";

export default function BookingNotFound() {
  return (
    <div className="card mx-auto max-w-md text-center">
      <div className="text-4xl font-bold text-muted-2">404</div>
      <p className="mt-2 text-sm text-muted">Booking not found — it may have been removed.</p>
      <Link href="/bookings" className="btn btn-primary mt-4">
        All bookings
      </Link>
    </div>
  );
}
