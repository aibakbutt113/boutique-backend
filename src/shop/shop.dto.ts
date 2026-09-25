import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString, Max, Min, ValidateNested,
} from 'class-validator';

export class CartLineDto {
  @IsString() variantId: string;
  @IsInt() @Min(1) quantity: number;
}
export class CartSyncDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => CartLineDto) items: CartLineDto[];
}

export class AddressDto {
  @IsString() fullName: string;
  @IsString() phone: string;
  @IsString() line1: string;
  @IsString() city: string;
  @IsString() province: string;
  @IsOptional() @IsString() postal?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class CreateOrderDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => CartLineDto) items: CartLineDto[];
  @ValidateNested() @Type(() => AddressDto) address: AddressDto;
  @IsEnum(['COD', 'JAZZCASH', 'EASYPAISA']) paymentMethod: 'COD' | 'JAZZCASH' | 'EASYPAISA';
  @IsOptional() @IsString() couponCode?: string;
}

export class ValidateCouponDto {
  @IsString() code: string;
  @IsInt() @Min(0) subtotal: number;
}

export class ReviewDto {
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsString() comment: string;
}

export class ReturnDto {
  @IsString() reason: string;
}

export class SubscribeDto {
  @IsEmail() email: string;
}

export class ProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
}

export class StatusDto {
  @IsEnum(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED'])
  status: string;
}

export class CouponDto {
  @IsString() code: string;
  @IsEnum(['PERCENT', 'FIXED']) type: 'PERCENT' | 'FIXED';
  @IsInt() @Min(1) value: number;
  @IsOptional() @IsInt() @Min(0) minOrder?: number;
  @IsOptional() @IsString() expiresAt?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
