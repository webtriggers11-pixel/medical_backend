import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        email: string;
        id: string;
        role: import("@prisma/client").$Enums.Role;
        isActive: boolean;
        isEmailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    findById(id: string): Promise<{
        email: string;
        id: string;
        role: import("@prisma/client").$Enums.Role;
        isActive: boolean;
        isEmailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findMe(id: string): Promise<{
        email: string;
        id: string;
        role: import("@prisma/client").$Enums.Role;
        isActive: boolean;
        isEmailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    create(dto: CreateUserDto): Promise<{
        email: string;
        id: string;
        role: import("@prisma/client").$Enums.Role;
        isActive: boolean;
        isEmailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
