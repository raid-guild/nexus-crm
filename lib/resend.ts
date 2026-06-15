import { Resend } from "resend";
import sgMail from "@sendgrid/mail";
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
    Boolean(process.env.SENDGRID_API_KEY)
  );
}

function createSendGridMailer() {
  const apiKey = process.env.SENDGRID_API_KEY;

  if (!apiKey) {
    throw new Error(
      "SendGrid API key is not configured. Set SENDGRID_API_KEY in the environment.",
    );
  }

  sgMail.setApiKey(apiKey);

  return {
    emails: {
      send: async ({ react, html, ...email }: SendEmailOptions) => {
        const renderedHtml = html ?? (react ? await render(react) : undefined);
        const attachments = email.attachments
          ?.filter((attachment) => attachment.content !== undefined)
          .map((attachment) => ({
            filename: attachment.filename || "attachment",
            type: attachment.contentType,
            disposition: "attachment" as const,
            content: Buffer.isBuffer(attachment.content)
              ? attachment.content.toString("base64")
              : Buffer.from(String(attachment.content)).toString("base64"),
          }));

        await sgMail.send({
          ...email,
          text: email.text ?? "",
          html: renderedHtml,
          attachments,
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
