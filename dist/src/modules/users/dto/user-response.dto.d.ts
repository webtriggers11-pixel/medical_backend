import { Role } from '../../../common/enums/role.enum';
export declare class UserResponseDto {
    id: string;
    email: string;
    role: Role;
    isActive: boolean;
    isEmailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
}
