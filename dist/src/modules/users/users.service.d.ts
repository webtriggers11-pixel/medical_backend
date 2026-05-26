import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        id: string;
        email: string;
        name: string | null;
        mobile: string | null;
        role: import("@prisma/client").$Enums.Role;
        companyId: string | null;
        isActive: boolean;
        isEmailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    findById(id: string): Promise<{
        id: string;
        email: string;
        name: string | null;
        mobile: string | null;
        role: import("@prisma/client").$Enums.Role;
        companyId: string | null;
        isActive: boolean;
        isEmailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findMe(id: string): Promise<{
        id: string;
        email: string;
        name: string | null;
        mobile: string | null;
        role: import("@prisma/client").$Enums.Role;
        companyId: string | null;
        isActive: boolean;
        isEmailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    create(dto: CreateUserDto): Promise<{
        id: string;
        email: string;
        name: string | null;
        mobile: string | null;
        role: import("@prisma/client").$Enums.Role;
        companyId: string | null;
        isActive: boolean;
        isEmailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
