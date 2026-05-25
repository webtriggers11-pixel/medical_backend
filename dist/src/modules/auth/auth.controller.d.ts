import { AuthService } from './auth.service';
import { InitiateRegisterDto } from './dto/initiate-register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CompleteRegisterDto } from './dto/complete-register.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    initiateRegister(dto: InitiateRegisterDto): Promise<{
        message: string;
        resendAllowedAt: string;
    }>;
    verifyOtp(dto: VerifyOtpDto): Promise<{
        setupToken: string;
    }>;
    completeRegister(dto: CompleteRegisterDto, user: any): Promise<{
        accessToken: string;
        user: {
            id: string;
            email: string;
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
    getMe(user: any): Promise<{
        id: string;
        email: string;
        role: import("@prisma/client").$Enums.Role;
        isActive: boolean;
        isEmailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
}
