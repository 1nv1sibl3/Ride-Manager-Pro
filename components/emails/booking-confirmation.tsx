import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { inr } from "@/lib/pricing";
import { fmtDate } from "@/lib/utils";
import { appUrl } from "@/lib/email";

const text = { color: "#3f3f46", fontSize: "14px", margin: "4px 0" } as const;
const label = { color: "#71717a", fontSize: "12px", margin: "0" } as const;

export function BookingConfirmationEmail({
  refNumber,
  customerName,
  vehicleModel,
  vehiclePlate,
  startAt,
  endAt,
  plan,
  rateUsed,
  quotedAmount,
  depositAmount,
}: {
  refNumber: number;
  customerName: string;
  vehicleModel: string;
  vehiclePlate: string;
  startAt: string;
  endAt: string;
  plan: "daily" | "monthly";
  rateUsed: number;
  quotedAmount: number;
  depositAmount: number;
}) {
  return (
    <Html>
      <Head />
      <Preview>{`Your ProBikes booking #${refNumber} is confirmed`}</Preview>
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "Helvetica, Arial, sans-serif", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "32px", maxWidth: "480px" }}>
          <Heading style={{ fontSize: "20px", margin: "0 0 4px" }}>Booking confirmed</Heading>
          <Text style={label}>Ref #{String(refNumber)} · ProBikes</Text>
          <Hr style={{ borderColor: "#e4e4e7", margin: "16px 0" }} />

          <Section>
            <Text style={label}>Customer</Text>
            <Text style={text}>{customerName}</Text>
            <Text style={label}>Vehicle</Text>
            <Text style={text}>
              {vehicleModel} · {vehiclePlate}
            </Text>
            <Text style={label}>Rental window</Text>
            <Text style={text}>
              {fmtDate(startAt)} → {fmtDate(endAt)}
            </Text>
            <Text style={label}>Plan</Text>
            <Text style={text}>
              {plan} · {inr(rateUsed)} / {plan === "monthly" ? "month" : "day"}
            </Text>
          </Section>

          <Hr style={{ borderColor: "#e4e4e7", margin: "16px 0" }} />

          <Section>
            <Text style={{ ...text, display: "flex", justifyContent: "space-between", margin: "6px 0" }}>
              <span>Quoted total</span>
              <b>{inr(quotedAmount)}</b>
            </Text>
            {depositAmount > 0 && (
              <Text style={{ ...text, display: "flex", justifyContent: "space-between", margin: "6px 0" }}>
                <span>Security deposit (refundable)</span>
                <b>{inr(depositAmount)}</b>
              </Text>
            )}
          </Section>

          <Hr style={{ borderColor: "#e4e4e7", margin: "16px 0" }} />
          <Text style={label}>
            Please carry the original documents you submitted when collecting the vehicle. Questions? Reply to this email or call the shop.
          </Text>
          <Link href={appUrl("/bookings")} style={{ color: "#2563eb", fontSize: "13px" }}>
            ProBikes Admin
          </Link>
        </Container>
      </Body>
    </Html>
  );
}
