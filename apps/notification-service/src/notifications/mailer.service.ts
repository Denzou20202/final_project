import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

@Injectable()
export class MailerService implements OnModuleDestroy {
  private readonly transporter: Transporter;
  private readonly fromAddress: string;

  constructor(config: ConfigService) {
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');
    const auth = user && pass ? { user, pass } : undefined;

    this.transporter = createTransport({
      host: config.get<string>('SMTP_HOST', 'localhost'),
      port: config.get<number>('SMTP_PORT', 3025),
      secure: config.get<string>('SMTP_SECURE', 'false') === 'true',
      ...(auth ? { auth } : {}),
    });
    this.fromAddress = config.get<string>('SUPPORT_EMAIL_ADDRESS', 'support@veloxdesk.local');
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    await this.transporter.sendMail({ from: this.fromAddress, to, subject, text });
  }

  onModuleDestroy(): void {
    this.transporter.close();
  }
}
