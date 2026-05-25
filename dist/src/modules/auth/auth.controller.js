"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_service_1 = require("./auth.service");
const initiate_register_dto_1 = require("./dto/initiate-register.dto");
const verify_otp_dto_1 = require("./dto/verify-otp.dto");
const complete_register_dto_1 = require("./dto/complete-register.dto");
const login_dto_1 = require("./dto/login.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const setup_token_guard_1 = require("../../common/guards/setup-token.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let AuthController = class AuthController {
    authService;
    constructor(authService) {
        this.authService = authService;
    }
    initiateRegister(dto) {
        return this.authService.initiateRegister(dto);
    }
    verifyOtp(dto) {
        return this.authService.verifyOtp(dto);
    }
    completeRegister(dto, user) {
        return this.authService.completeRegister(user.sub, dto);
    }
    login(dto) {
        return this.authService.login(dto);
    }
    getMe(user) {
        return this.authService.getMe(user.id);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('register/initiate'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Step 1: Send OTP to email' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'OTP sent successfully' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Email already registered' }),
    (0, swagger_1.ApiResponse)({ status: 429, description: 'Resend cooldown active' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [initiate_register_dto_1.InitiateRegisterDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "initiateRegister", null);
__decorate([
    (0, common_1.Post)('register/verify-otp'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Step 2: Verify OTP and receive setup token' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'OTP verified, setup token issued' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid or expired OTP' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_otp_dto_1.VerifyOtpDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "verifyOtp", null);
__decorate([
    (0, common_1.Post)('register/complete'),
    (0, common_1.UseGuards)(setup_token_guard_1.SetupTokenGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Step 3: Set password using setup token' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Account created, access token issued' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid or expired setup token' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [complete_register_dto_1.CompleteRegisterDto, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "completeRegister", null);
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Login with email and password' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Login successful' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid credentials' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Account inactive or unverified' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get current authenticated user' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Current user returned' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "getMe", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('Auth'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map