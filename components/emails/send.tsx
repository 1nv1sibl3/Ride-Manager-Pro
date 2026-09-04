// Typed send wrappers around the email templates. This file exists so server
// actions (plain .ts) can fire emails without embedding JSX.

import { sendEmail } from "@/lib/email";
import { BookingConfirmationEmail } from "./booking-confirmation";
import { PaymentReceiptEmail } from "./payment-receipt";
import { ReminderDigestEmail, type DigestSection } from "./reminder-digest";

export async function sendBookingConfirmation(opts: {
  to: string;
  refNumber: number;
  customerName: string;
  vehicleModel: string;
  vehiclePlate: string;
  startAt: Date;
  endAt: Date;
  plan: "daily" | "monthly";
  rateUsed: number;
  quotedAmount: number;
  depositAmount: number;
}) {
  return sendEmail({
    to: opts.to,
    subject: `Booking #${opts.refNumber} confirmed — ProBikes`,
    react: (
      <BookingConfirmationEmail
        refNumber={opts.refNumber}
        customerName={opts.customerName}
        vehicleModel={opts.vehicleModel}
        vehiclePlate={opts.vehiclePlate}
        startAt={opts.startAt.toISOString()}
        endAt={opts.endAt.toISOString()}
        plan={opts.plan}
        rateUsed={opts.rateUsed}
        quotedAmount={opts.quotedAmount}
        depositAmount={opts.depositAmount}
      />
    ),
  });
}

export async function sendPaymentReceipt(opts: {
  to: string;
  refNumber: number;
  customerName: string;
  kind: string;
  amount: number;
  mode: string;
  reference?: string | null;
  note?: string | null;
  recordedAt: Date;
  balanceDue: number;
}) {
  return sendEmail({
    to: opts.to,
    subject: `Receipt — ${opts.kind.replace("_", " ")} on booking #${opts.refNumber} — ProBikes`,
    react: (
      <PaymentReceiptEmail
        refNumber={opts.refNumber}
        customerName={opts.customerName}
        kind={opts.kind}
        amount={opts.amount}
        mode={opts.mode}
        reference={opts.reference}
        note={opts.note}
        recordedAt={opts.recordedAt.toISOString()}
        balanceDue={opts.balanceDue}
      />
    ),
  });
}

export async function sendDigest(opts: {
  to: string;
  sections: DigestSection[];
  generatedAt: Date;
  total: number;
}) {
  return sendEmail({
    to: opts.to,
    subject: `ProBikes daily digest — ${opts.total} item${opts.total === 1 ? "" : "s"} need attention`,
    react: (
      <ReminderDigestEmail
        sections={opts.sections}
        generatedAt={opts.generatedAt.toISOString()}
      />
    ),
  });
}
