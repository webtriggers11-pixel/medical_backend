import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { InitiateRegisterDto } from './dto/initiate-register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CompleteRegisterDto } from './dto/complete-register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  async initiateRegister(dto: InitiateRegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing?.isEmailVerified) {
      throw new ConflictException('Email is already registered');
    }

    // Enforce 60s resend cooldown
    if (existing?.otpResendAllowedAt && existing.otpResendAllowedAt > new Date()) {
      const secondsRemaining = Math.ceil(
        (existing.otpResendAllowedAt.getTime() - Date.now()) / 1000,
      );
      throw new HttpException(
        { message: 'Please wait before requesting a new OTP', secondsRemaining },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = this.generateOtp();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const otpResendAllowedAt = new Date(Date.now() + 60 * 1000);

    await this.prisma.user.upsert({
      where: { email: dto.email },
      create: {
        email: dto.email,
        otpCode: hashedOtp,
        otpExpiresAt,
        otpResendAllowedAt,
      },
      update: {
        otpCode: hashedOtp,
        otpExpiresAt,
        otpResendAllowedAt,
      },
    });

    await this.mailService.sendOtp(dto.email, otp);

    return {
      message: 'OTP sent to your email',
      resendAllowedAt: otpResendAllowedAt.toISOString(),
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.otpCode || !user.otpExpiresAt) {
      throw new BadRequestException('OTP not found. Please request a new one');
    }

    if (user.otpExpiresAt < new Date()) {
      throw new BadRequestException('OTP has expired. Please request a new one');
    }

    const isValid = await bcrypt.compare(dto.otp, user.otpCode);
    if (!isValid) {
      throw new BadRequestException('Invalid OTP');
    }

    // Clear OTP fields after successful verification
    await this.prisma.user.update({
      where: { email: dto.email },
      data: { otpCode: null, otpExpiresAt: null, otpResendAllowedAt: null },
    });

    const setupToken = this.jwtService.sign(
      { sub: user.id, email: user.email, type: 'setup' },
      { expiresIn: '15m' },
    );

    return { setupToken };
  }

  async completeRegister(userId: string, dto: CompleteRegisterDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.isEmailVerified) {
      throw new ConflictException('Account already set up');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        isEmailVerified: true,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        createdAt: true,
      },
    });

    const accessToken = this.signAccessToken(updatedUser.id, updatedUser.email, updatedUser.role);

    return { accessToken, user: updatedUser };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new ForbiddenException('Email not verified. Please complete registration');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated. Contact support');
    }

    const accessToken = this.signAccessToken(user.id, user.email, user.role);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
      },
    };
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private signAccessToken(userId: string, email: string, role: string): string {
    return this.jwtService.sign({
      sub: userId,
      email,
      role,
      type: 'access',
    });
  }
}
