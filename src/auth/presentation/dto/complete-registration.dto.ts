import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { UserRole } from '../../infrastructure/persistence/auth-identity.entity';

export class CompleteRegistrationDto {
    @IsString()
    @IsNotEmpty()
    setupToken: string;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsEnum(UserRole, {
        message: `Role must be one of the following values: ${Object.values(UserRole).join(', ')}`
    })
    role?: UserRole;

}
