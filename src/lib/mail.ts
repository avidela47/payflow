import nodemailer from "nodemailer";

// SMTP de Hostinger (admin@itelsasas.com): smtp.hostinger.com, puerto 465
// con SSL. Todo sale de variables de entorno — nada de credenciales acá.
function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    throw new Error(
      "Faltan variables de entorno de SMTP (SMTP_HOST / SMTP_USER / SMTP_PASSWORD)."
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true para 465 (SSL), false para 587 (STARTTLS)
    auth: { user, pass },
  });
}

export async function sendMail(opts: { to: string; subject: string; text: string; html: string }) {
  const transporter = getTransporter();
  const from = process.env.SMTP_USER;

  await transporter.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}