import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

// Admin toggles a client's active state.
export class UpdateClientDto {
  @ApiProperty({ example: false, description: 'Whether the client is active' })
  @IsBoolean()
  isActive: boolean;
}
