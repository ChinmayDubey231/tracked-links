import { config } from '../config';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Resend drops a repeat send with the same key, so a retry never emails twice. */
  idempotencyKey?: string;
}

export interface Mailer {
  readonly name: 'resend' | 'console' | 'memory';
  send(message: EmailMessage): Promise<void>;
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 10_000;

/** Sends through Resend's HTTP API, so no SDK is needed. */
export class ResendMailer implements Mailer {
  readonly name = 'resend';
  private readonly apiKey: string;
  private readonly from: string;

  constructor(apiKey: string, from: string) {
    this.apiKey = apiKey;
    this.from = from;
  }

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...(message.idempotencyKey && { 'Idempotency-Key': message.idempotencyKey }),
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Resend refused the email (${response.status}): ${detail.slice(0, 300)}`);
    }
  }
}

/** Development without RESEND_API_KEY: the email is printed instead of sent. */
class ConsoleMailer implements Mailer {
  readonly name = 'console';

  async send(message: EmailMessage): Promise<void> {
    console.log(`\n[email, not sent: RESEND_API_KEY is empty]\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`);
  }
}

/** Tests: keeps what was sent so they can check it. */
export class MemoryMailer implements Mailer {
  readonly name = 'memory';
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

function createMailer(): Mailer {
  if (config.isTest) return new MemoryMailer();
  if (config.RESEND_API_KEY) return new ResendMailer(config.RESEND_API_KEY, config.EMAIL_FROM);
  return new ConsoleMailer();
}

export const mailer = createMailer();
