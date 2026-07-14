import nodemailer from "nodemailer";

import type {
  EmailDelivery,
  EmailMessage,
  EmailSender,
} from "../../ports/outreach.js";
import { AppError } from "../../shared/errors.js";

export interface NodemailerEmailSenderOptions {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from: string;
}

export class NodemailerEmailSender implements EmailSender {
  public constructor(private readonly options: NodemailerEmailSenderOptions) {}

  public async send(message: EmailMessage): Promise<EmailDelivery> {
    if (
      this.options.username.length === 0 ||
      this.options.password.length === 0 ||
      this.options.from.length === 0
    ) {
      throw new AppError(
        "SMTP credentials or sender are not configured",
        "SMTP_CONFIG_MISSING",
      );
    }
    const transport = nodemailer.createTransport({
      host: this.options.host,
      port: this.options.port,
      secure: this.options.secure,
      auth: { user: this.options.username, pass: this.options.password },
    });
    const result = await transport.sendMail({
      from: this.options.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      headers: { "X-MoneyPrinter-Idempotency-Key": message.idempotencyKey },
    });
    return { messageId: result.messageId, provider: "smtp" };
  }
}
