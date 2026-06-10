import { Resend } from "resend";
import nodemailer from "nodemailer";
import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { prismadb } from "./prisma";

type EmailAttachment = {
  filename?: string;
  content?: string | Buffer;
  path?: string;
  contentType?: string;
};

type SendEmailOptions = {
  from: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  react?: ReactElement;
  attachments?: EmailAttachment[];
};

function shouldUseSendGrid() {
  return (
    process.env.EMAIL_PROVIDER === "sendgrid" ||
    Boolean(process.env.SENDGRID_API_KEY) ||
    process.env.EMAIL_HOST === "smtp.sendgrid.net"
  );
}

function createSendGridMailer() {
  const apiKey = process.env.SENDGRID_API_KEY || process.env.EMAIL_PASSWORD;

  if (!apiKey) {
    throw new Error(
      "SendGrid API key is not configured. Set SENDGRID_API_KEY in the environment.",
    );
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.sendgrid.net",
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USERNAME || "apikey",
      pass: apiKey,
    },
  });

  return {
    emails: {
      send: async ({ react, html, ...email }: SendEmailOptions) => {
        const renderedHtml = html ?? (react ? await render(react) : undefined);

        await transporter.sendMail({
          ...email,
          html: renderedHtml,
        });
      },
    },
  };
}

export default async function resendHelper() {
  if (shouldUseSendGrid()) {
    return createSendGridMailer();
  }

  const resendKey = await prismadb.systemServices.findFirst({
    where: {
      name: "resend_smtp",
    },
  });

  const apiKey = process.env.RESEND_API_KEY || resendKey?.serviceKey;

  if (!apiKey) {
    throw new Error(
      "Resend API key is not configured. Please add it in Admin settings or set RESEND_API_KEY environment variable.",
    );
  }

  const resend = new Resend(apiKey);

  return resend;
}
