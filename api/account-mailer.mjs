import nodemailer from "nodemailer";

let transporter;

function clean(value) {
  return String(value || "").trim();
}

function smtpPort() {
  return Number(process.env.SMTP_PORT || 587);
}

function smtpSecure() {
  return String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || smtpPort() === 465;
}

export function isAccountEmailDeliveryConfigured() {
  return Boolean(
    clean(process.env.SMTP_HOST) &&
      clean(process.env.SMTP_USER) &&
      clean(process.env.SMTP_PASSWORD) &&
      clean(process.env.ACCOUNT_EMAIL_FROM)
  );
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: clean(process.env.SMTP_HOST),
      port: smtpPort(),
      secure: smtpSecure(),
      auth: {
        user: clean(process.env.SMTP_USER),
        pass: clean(process.env.SMTP_PASSWORD)
      }
    });
  }
  return transporter;
}

export async function sendAccountLoginCode({ email, code, expiresInMinutes }) {
  if (!isAccountEmailDeliveryConfigured()) {
    throw new Error("account_email_delivery_unavailable");
  }

  const subject = "Your Green Leaf Pacific login code";
  const text = [
    `Your Green Leaf Pacific customer account login code is ${code}.`,
    "",
    `This code expires in ${expiresInMinutes} minutes.`,
    "If you did not request this code, you can ignore this email."
  ].join("\n");

  await getTransporter().sendMail({
    from: clean(process.env.ACCOUNT_EMAIL_FROM),
    to: email,
    subject,
    text,
    disableFileAccess: true,
    disableUrlAccess: true,
    html: `
      <div style="font-family:Arial,sans-serif;color:#1f3026;line-height:1.6;max-width:560px">
        <h1 style="font-size:24px;margin:0 0 16px">Green Leaf Pacific</h1>
        <p style="margin:0 0 12px">Use this code to open your customer account:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:0 0 12px">${code}</p>
        <p style="margin:0 0 12px">The code expires in ${expiresInMinutes} minutes.</p>
        <p style="color:#657168;margin:0">If you did not request this code, you can ignore this email.</p>
      </div>
    `
  });
}
