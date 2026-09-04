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
import { appUrl } from "@/lib/email";
import { fmtDateShort } from "@/lib/utils";

export type DigestItem = {
  title: string;
  detail?: string;
  href?: string;
};

export type DigestSection = {
  title: string;
  items: DigestItem[];
};

export function ReminderDigestEmail({
  sections,
  generatedAt,
}: {
  sections: DigestSection[];
  generatedAt: string;
}) {
  const total = sections.reduce((s, sec) => s + sec.items.length, 0);
  return (
    <Html>
      <Head />
      <Preview>{`ProBikes daily digest — ${total} item${total === 1 ? "" : "s"} need attention`}</Preview>
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "Helvetica, Arial, sans-serif", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "32px", maxWidth: "520px" }}>
          <Heading style={{ fontSize: "20px", margin: "0 0 4px" }}>Today at the shop</Heading>
          <Text style={{ color: "#71717a", fontSize: "12px", margin: "0" }}>
            Generated {fmtDateShort(generatedAt)} · ProBikes Admin
          </Text>
          <Hr style={{ borderColor: "#e4e4e7", margin: "16px 0" }} />

          {sections.map((sec) => (
            <Section key={sec.title} style={{ marginBottom: "20px" }}>
              <Text style={{ fontSize: "13px", fontWeight: 700, margin: "0 0 8px", color: "#18181b" }}>
                {sec.title} ({String(sec.items.length)})
              </Text>
              {sec.items.map((item, i) => (
                <Text key={i} style={{ color: "#3f3f46", fontSize: "14px", margin: "6px 0" }}>
                  • {item.href ? <Link href={appUrl(item.href)} style={{ color: "#2563eb" }}>{item.title}</Link> : item.title}
                  {item.detail && <span style={{ color: "#71717a", fontSize: "12px" }}> — {item.detail}</span>}
                </Text>
              ))}
            </Section>
          ))}

          {total === 0 && (
            <Text style={{ color: "#3f3f46", fontSize: "14px" }}>Nothing needs attention today. 🎉</Text>
          )}

          <Hr style={{ borderColor: "#e4e4e7", margin: "16px 0" }} />
          <Link href={appUrl("/dashboard")} style={{ color: "#2563eb", fontSize: "13px" }}>
            Open ProBikes Admin
          </Link>
        </Container>
      </Body>
    </Html>
  );
}
