import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SetCompanyPricingDto {
  @ApiProperty()
  @IsString()
  companyId: string;

  @ApiProperty({ description: 'What the company pays per candidate (INR)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  costToClient: number;

  @ApiPropertyOptional({ description: 'Trigger loyalty discount after N bookings (0 = no discount)' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  discountAfterN?: number;

  @ApiPropertyOptional({ description: 'Discounted price after N bookings (INR)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  discountedPrice?: number;
}
