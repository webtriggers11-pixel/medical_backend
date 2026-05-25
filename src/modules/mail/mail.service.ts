import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { otpEmailTemplate } from './templates/otp.template';

@Injectable()
export class MailService {
  private resend: Resend;
  private readonly logger = new Logger(MailService.name);

  constructor(private configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  async sendOtp(email: string, otp: string): Promise<void> {
    try {
      const { error } = await this.resend.emails.send({
        from: this.configService.get<string>('SMTP_FROM') || 'MediSync <onboarding@resend.dev>',
        to: email,
        subject: 'Your MediSync Verification Code',
        html: otpEmailTemplate(otp),
      });

      if (error) {
        throw new Error(error.message);
      }

      this.logger.log(`OTP email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${email}`, error);
      throw error;
    }
  }
}
