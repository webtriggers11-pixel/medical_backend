import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { otpEmailTemplate } from './templates/otp.template';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor(private configService: ConfigService) {
    const port = this.configService.get<number>('SMTP_PORT') || 465;
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port,
      secure: port === 465,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
  }

  async sendOtp(email: string, otp: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM'),
        to: email,
        subject: 'Your MediSync Verification Code',
        html: otpEmailTemplate(otp),
      });
      this.logger.log(`OTP email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${email}`, error);
      throw error;
    }
  }
}
