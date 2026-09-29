import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles, RolesGuard } from '../common/auth.js';
import { CatalogService } from './catalog.service.js';
import { BrandDto, CategoryDto, ProductDto, ProductQueryDto } from './catalog.dto.js';

@Controller()
export class CatalogController {
  constructor(private catalog: CatalogService) {}

  @Get('categories') categories() { return this.catalog.categories(); }
  @Get('brands') brands() { return this.catalog.brands(); }
  @Get('products') products(@Query() q: ProductQueryDto) { return this.catalog.products(q); }
  @Get('products/:slug') product(@Param('slug') slug: string) { return this.catalog.product(slug); }

  @Get('admin/products') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
  adminProducts(@Query() q: ProductQueryDto) { return this.catalog.products(q, true); }

  @Post('admin/products') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
  create(@Body() d: ProductDto) { return this.catalog.create(d); }

  @Patch('admin/products/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
  update(@Param('id') id: string, @Body() d: Partial<ProductDto>) { return this.catalog.update(id, d); }

  @Delete('admin/products/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
  remove(@Param('id') id: string) { return this.catalog.remove(id); }

  @Post('admin/categories') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
  createCategory(@Body() d: CategoryDto) { return this.catalog.createCategory(d.name, d.image, d.parentId); }

  @Delete('admin/categories/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
  removeCategory(@Param('id') id: string) { return this.catalog.removeCategory(id); }

  @Get('admin/brands') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
  adminBrands() { return this.catalog.adminBrands(); }

  @Post('admin/brands') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
  createBrand(@Body() d: BrandDto) { return this.catalog.createBrand(d); }

  @Patch('admin/brands/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
  updateBrand(@Param('id') id: string, @Body() d: Partial<BrandDto>) { return this.catalog.updateBrand(id, d); }

  @Delete('admin/brands/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
  removeBrand(@Param('id') id: string) { return this.catalog.removeBrand(id); }
}
