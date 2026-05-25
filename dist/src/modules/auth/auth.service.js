"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../../prisma/prisma.service");
const mail_service_1 = require("../mail/mail.service");
let AuthService = class AuthService {
    prisma;
    jwtService;
    configService;
    mailService;
    constructor(prisma, jwtService, configService, mailService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.configService = configService;
        this.mailService = mailService;
    }
    async initiateRegister(dto) {
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (existing?.isEmailVerified) {
            throw new common_1.ConflictException('Email is already registered');
        }
        if (existing?.otpResendAllowedAt && existing.otpResendAllowedAt > new Date()) {
            const secondsRemaining = Math.ceil((existing.otpResendAllowedAt.getTime() - Date.now()) / 1000);
            throw new common_1.HttpException({ message: 'Please wait before requesting a new OTP', secondsRemaining }, common_1.HttpStatus.TOO_MANY_REQUESTS);
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
    async verifyOtp(dto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (!user || !user.otpCode || !user.otpExpiresAt) {
            throw new common_1.BadRequestException('OTP not found. Please request a new one');
        }
        if (user.otpExpiresAt < new Date()) {
            throw new common_1.BadRequestException('OTP has expired. Please request a new one');
        }
        const isValid = await bcrypt.compare(dto.otp, user.otpCode);
        if (!isValid) {
            throw new common_1.BadRequestException('Invalid OTP');
        }
        await this.prisma.user.update({
            where: { email: dto.email },
            data: { otpCode: null, otpExpiresAt: null, otpResendAllowedAt: null },
        });
        const setupToken = this.jwtService.sign({ sub: user.id, email: user.email, type: 'setup' }, { expiresIn: '15m' });
        return { setupToken };
    }
    async completeRegister(userId, dto) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new common_1.UnauthorizedException('User not found');
        }
        if (user.isEmailVerified) {
            throw new common_1.ConflictException('Account already set up');
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
    async login(dto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (!user || !user.password) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const passwordMatch = await bcrypt.compare(dto.password, user.password);
        if (!passwordMatch) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        if (!user.isEmailVerified) {
            throw new common_1.ForbiddenException('Email not verified. Please complete registration');
        }
        if (!user.isActive) {
            throw new common_1.ForbiddenException('Account is deactivated. Contact support');
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
    async getMe(userId) {
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
    generateOtp() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
    signAccessToken(userId, email, role) {
        return this.jwtService.sign({
            sub: userId,
            email,
            role,
            type: 'access',
        });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService,
        mail_service_1.MailService])
], AuthService);
//# sourceMappingURL=auth.service.js.map