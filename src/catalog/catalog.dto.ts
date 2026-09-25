import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested,
} from 'class-validator';

export class VariantDto {
  @IsString() size: string;
  @IsString() color: string;
  @IsInt() @Min(0) stock: number;
}

export class ProductDto {
  @IsString() name: string;
  @IsString() description: string;
  @IsOptional() @IsString() fabric?: string;
  @IsInt() @Min(0) price: number;
  @IsOptional() @IsInt() @Min(0) salePrice?: number | null;
  @IsOptional() @IsBoolean() isNew?: boolean;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsString() categoryId: string;
  @IsOptional() @IsArray() @IsString({ each: true }) images?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => VariantDto) variants?: VariantDto[];
}

export class ProductQueryDto {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() fabric?: string;
  @IsOptional() @IsString() size?: string;
  @IsOptional() @IsString() sale?: string;
  @IsOptional() @IsString() isNew?: string;
  @IsOptional() @IsString() featured?: string;
  @IsOptional() @IsString() minPrice?: string;
  @IsOptional() @IsString() maxPrice?: string;
  @IsOptional() @IsString() sort?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() limit?: string;
}

export class CategoryDto {
  @IsString() name: string;
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsString() parentId?: string;
}
