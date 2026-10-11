import { Type } from "class-transformer";
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  IsInt,
  IsOptional,
  IsIn,
  IsUrl,
  MinLength,
  IsEmail,
  IsDefined,
  IsUUID,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ServiceType, ShipmentStatus } from "@prisma/client";
export class PointDto {
  @ApiProperty({ example: 10.754 }) @IsNumber() @IsLatitude() lat!: number;
  @ApiProperty({ example: 106.663 }) @IsNumber() @IsLongitude() lng!: number;
}
export class AddressDto extends PointDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(255) line!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) ward!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) district!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) city!: string;
}
export class ParcelDto {
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999.99)
  weightKg!: number;
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999.99)
  lengthCm!: number;
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999.99)
  widthCm!: number;
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999.99)
  heightCm!: number;
}
export class BookingDto {
  @ApiProperty({ type: AddressDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => AddressDto)
  pickupAddress!: AddressDto;
  @ApiProperty({ type: AddressDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => AddressDto)
  dropoffAddress!: AddressDto;
  @ApiProperty({ type: ParcelDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => ParcelDto)
  parcel!: ParcelDto;
  @ApiProperty({ enum: ServiceType })
  @IsEnum(ServiceType)
  serviceType!: ServiceType;
}
export class RespondDto {
  @ApiProperty({ enum: ["ACCEPT", "REJECT"] })
  @IsIn(["ACCEPT", "REJECT"])
  action!: "ACCEPT" | "REJECT";
}
export class TransitionDto {
  @ApiProperty({ enum: ShipmentStatus })
  @IsEnum(ShipmentStatus)
  toStatus!: ShipmentStatus;
}
export class DriverStatusDto {
  @ApiProperty({ enum: ["AVAILABLE", "OFFLINE"] })
  @IsIn(["AVAILABLE", "OFFLINE"])
  status!: "AVAILABLE" | "OFFLINE";
}
export class PageDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
export class ShipmentPageDto extends PageDto {
  @ApiPropertyOptional({ enum: ShipmentStatus })
  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;
}
export class SubscriptionDto {
  @ApiProperty()
  @IsUrl({ require_tld: false, protocols: ["http", "https"] })
  url!: string;
  @ApiProperty({ writeOnly: true, minLength: 32 })
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  secret!: string;
}
export class PricingRuleDto {
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000000)
  baseFee!: number;
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000000)
  ratePerKm!: number;
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999)
  freeWeightThreshold!: number;
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000000)
  ratePerExtraKg!: number;
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  standardMultiplier!: number;
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  expressMultiplier!: number;
}
export class RegisterDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(72)
  password!: string;
  @ApiProperty({ enum: ["SENDER", "DRIVER"] })
  @IsIn(["SENDER", "DRIVER"])
  role!: "SENDER" | "DRIVER";
}
export class LoginDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @MaxLength(72) password!: string;
}
export class RefreshDto {
  @ApiProperty()
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  refreshToken!: string;
}
export const uuidParam = { version: "4" } as const;

export class AssignDto {
  @ApiPropertyOptional({
    format: "uuid",
    description: "Optional explicit driver for dispatcher intervention",
  })
  @IsOptional()
  @IsUUID("4")
  driverId?: string;
}
