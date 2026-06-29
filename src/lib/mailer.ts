import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { captureException } from "@/lib/observability";

// Generic SMTP transport configured from env. Works with any provider
// (Gmail app password, Mailgun, SES, Postmark, Resend SMTP, …).
//
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
//
// If SMTP is not configured we fall back to logging the message to the server
// console (dev) so the OTP flow is testable without a real mail server.

let cached: Transporter | null = null;

function transport(): Transporter | null {
  if (cached) return cached;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const port = Number(SMTP_PORT ?? 587);
  cached = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465, // implicit TLS on 465, STARTTLS otherwise
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    // Office365/Gmail can be slow to negotiate; give them room.
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
  });
  return cached;
}

// Read FROM lazily so it reflects env at call time, not module-load time.
function fromAddress(): string {
  return process.env.EMAIL_FROM ?? "ScoreFit <no-reply@scorefit.net>";
}

export async function sendMail(opts: { to: string; subject: string; html: string; text: string }) {
  const t = transport();
  if (!t) {
    // Dev fallback — surface the content so OTP flows can be tested locally.
    console.warn(
      `[mailer] SMTP not configured (SMTP_HOST/USER/PASS missing); would send to ${opts.to}\n` +
        `  Subject: ${opts.subject}\n  ${opts.text}`,
    );
    return;
  }
  try {
    const info = await t.sendMail({
      from: fromAddress(),
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    console.log(`[mailer] sent to ${opts.to} (${info.messageId})`);
  } catch (err) {
    // Re-throw so the caller can decide; but forward the real SMTP error first so
    // transactional-email failures are visible in observability (not just console).
    const e = err as { code?: string; responseCode?: number; command?: string; message?: string };
    await captureException(err, {
      where: "mailer.send",
      extra: { to: opts.to, subject: opts.subject, code: e.code, responseCode: e.responseCode, command: e.command },
    });
    throw err;
  }
}

const wrap = (title: string, body: string) => `
  <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#07090c;color:#f1f4f7;border-radius:16px">
    <p style="font-family:ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;font-size:11px;color:#ff6a3d;margin:0 0 16px">ScoreFit</p>
    <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
    ${body}
    <p style="font-size:12px;color:#6b747c;margin-top:24px">If you didn't request this, you can ignore this email.</p>
  </div>`;

export async function sendVerificationCode(to: string, code: string) {
  await sendMail({
    to,
    subject: "Your ScoreFit verification code",
    text: `Your ScoreFit verification code is ${code}. It expires in 10 minutes.`,
    html: wrap(
      "Verify your email",
      `<p style="color:#9ba4ad">Enter this code to verify your email. It expires in 10 minutes.</p>
       <p style="font-family:ui-monospace,monospace;font-size:32px;letter-spacing:8px;color:#2dd4bf;margin:16px 0">${code}</p>`,
    ),
  });
}

export async function sendPasswordResetCode(to: string, code: string) {
  await sendMail({
    to,
    subject: "Reset your ScoreFit password",
    text: `Your ScoreFit password reset code is ${code}. It expires in 10 minutes.`,
    html: wrap(
      "Reset your password",
      `<p style="color:#9ba4ad">Use this code to reset your password. It expires in 10 minutes.</p>
       <p style="font-family:ui-monospace,monospace;font-size:32px;letter-spacing:8px;color:#2dd4bf;margin:16px 0">${code}</p>`,
    ),
  });
}

export async function sendWeeklyDigest(to: string, stats: { sessions: number; tonnage: number; unit: string }) {
  const s = stats.sessions === 1 ? "session" : "sessions";
  await sendMail({
    to,
    subject: "Your ScoreFit week in review",
    text: `This week you logged ${stats.sessions} ${s} and moved ${stats.tonnage.toLocaleString()} ${stats.unit}. Keep the momentum: https://scorefit.net/dashboard`,
    html: wrap(
      "Your week in review",
      `<p style="color:#9ba4ad">Nice work this week.</p>
       <p style="font-size:15px;color:#f1f4f7;margin:12px 0"><b>${stats.sessions}</b> ${s} · <b>${stats.tonnage.toLocaleString()} ${stats.unit}</b> moved</p>
       <p><a href="https://scorefit.net/dashboard" style="color:#ff6a3d">Open your dashboard →</a></p>
       <p style="color:#6b747c;font-size:12px;margin-top:16px">Manage these emails in your <a href="https://scorefit.net/account/notifications" style="color:#6b747c">notification settings</a>.</p>`,
    ),
  });
}
