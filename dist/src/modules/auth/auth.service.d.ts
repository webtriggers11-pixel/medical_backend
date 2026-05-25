import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { InitiateRegisterDto } from './dto/initiate-register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CompleteRegisterDto } from './dto/complete-register.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private prisma;
    private jwtService;
    private configService;
    private mailService;
    constructor(prisma: PrismaService, jwtService: JwtService, configService: ConfigService, mailService: MailService);
    initiateRegister(dto: InitiateRegisterDto): Promise<{
        message: string;
        resendAllowedAt: string;
    }>;
    verifyOtp(dto: VerifyOtpDto): Promise<{
        setupToken: string;
    }>;
    completeRegister(userId: string, dto: CompleteRegisterDto): Promise<{
        accessToken: string;
        user: {
            email: string;
            id: string;
            role: import("@prisma/client").$Enums.Role;
            isActive: boolean;
            isEmailVerified: boolean;
            createdAt: Date;
        };
    }>;
    login(dto: LoginDto): Promise<{
        accessToken: string;
        user: {
            id: string;
            email: string;
            role: import("@prisma/client").$Enums.Role;
            isActive: true;
            isEmailVerified: true;
            createdAt: Date;
        };
    }>;
    getMe(userId: string): Promise<{
        email: string;
        id: string;
        role: import("@prisma/client").$Enums.Role;
        isActive: boolean;
        isEmailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    private generateOtp;
    private signAccessToken;
}
