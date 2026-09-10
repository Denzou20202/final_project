import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

@Injectable()
export class MailerService implements OnModuleDestroy {
  private readonly transporter: Transporter;
  private readonly fromAddress: string;

  constructor(config: ConfigService) {
    this.transporter = createTransport({
      host: config.get<string>('SMTP_HOST', 'localhost'),
      port: config.get<number>('SMTP_PORT', 3025),
      secure: config.get<string>('SMTP_SECURE', 'false') === 'true',
      auth: {
        user: config.getOrThrow<string>('SMTP_USER'),
        pass: config.getOrThrow<string>('SMTP_PASS'),
      },
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
