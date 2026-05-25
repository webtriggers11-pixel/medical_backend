import { ConfigService } from '@nestjs/config';
export declare class MailService {
    private configService;
    private transporter;
    private readonly logger;
    constructor(configService: ConfigService);
    sendOtp(email: string, otp: string): Promise<void>;
}
