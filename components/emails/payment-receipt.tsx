import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { inr } from "@/lib/pricing";
import { fmtDate } from "@/lib/utils";

const text = { color: "#3f3f46", fontSize: "14px", margin: "4px 0" } as const;
const label = { color: "#71717a", fontSize: "12px", margin: "0" } as const;

export function PaymentReceiptEmail({
  refNumber,
  customerName,
  kind,
  amount,
  mode,
  reference,
  note,
  recordedAt,
  balanceDue,
}: {
  refNumber: number;
  customerName: string;
  kind: string;
  amount: number;
  mode: string;
  reference?: string | null;
  note?: string | null;
  recordedAt: string;
  balanceDue: number;
}) {
  return (
    <Html>
      <Head />
      <Preview>{`ProBikes payment receipt — booking #${refNumber}`}</Preview>
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "Helvetica, Arial, sans-serif", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "32px", maxWidth: "480px" }}>
          <Heading style={{ fontSize: "20px", margin: "0 0 4px" }}>Payment recorded</Heading>
          <Text style={label}>Ref #{String(refNumber)} · ProBikes</Text>
          <Hr style={{ borderColor: "#e4e4e7", margin: "16px 0" }} />

          <Section>
            <Text style={{ fontSize: "28px", fontWeight: 700, margin: "8px 0" }}>{inr(amount)}</Text>
            <Text style={text}>
              {kind.replace("_", " ")} · paid by {mode}
              {reference ? ` · ref ${reference}` : ""}
            </Text>
            <Text style={label}>Booked for {customerName}</Text>
            <Text style={label}>{fmtDate(recordedAt)}</Text>
            {note && <Text style={label}>Note: {note}</Text>}
          </Section>

          <Hr style={{ borderColor: "#e4e4e7", margin: "16px 0" }} />

          <Section>
            <Text style={{ ...text, display: "flex", justifyContent: "space-between", margin: "6px 0" }}>
              <span>Remaining balance</span>
              <b>{inr(balanceDue)}</b>
            </Text>
          </Section>

          <Hr style={{ borderColor: "#e4e4e7", margin: "16px 0" }} />
          <Text style={label}>This is a record of a payment collected at the shop. Keep it for your reference.</Text>
        </Container>
      </Body>
    </Html>
  );
}
