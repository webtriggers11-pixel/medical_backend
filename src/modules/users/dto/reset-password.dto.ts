import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

// Admin resets a client's login password. Only the new password is sent —
// the "confirm password" check is enforced on the frontend.
export class ResetPasswordDto {
  @ApiProperty({ example: 'NewStrongP@ss123', minLength: 8 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
