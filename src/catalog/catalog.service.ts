import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ProductDto, ProductQueryDto } from './catalog.dto.js';

export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const productInclude = {
  images: { orderBy: { position: 'asc' } },
  category: true,
  variants: true,
} satisfies Prisma.ProductInclude;

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  categories() {
    return this.prisma.category.findMany({ orderBy: { position: 'asc' }, include: { children: true } });
  }

  async products(q: ProductQueryDto, admin = false) {
    const where: Prisma.ProductWhereInput = admin ? {} : { isActive: true };
    if (q.category) {
      const cat = await this.prisma.category.findUnique({
        where: { slug: q.category },
        include: { children: true },
      });
      where.categoryId = { in: cat ? [cat.id, ...cat.children.map((c) => c.id)] : [] };
    }
    if (q.q) where.OR = [
      { name: { contains: q.q, mode: 'insensitive' } },
      { description: { contains: q.q, mode: 'insensitive' } },
      { fabric: { contains: q.q, mode: 'insensitive' } },
    ];
    if (q.fabric) where.fabric = { equals: q.fabric, mode: 'insensitive' };
    if (q.sale === 'true') where.salePrice = { not: null };
    if (q.isNew === 'true') where.isNew = true;
    if (q.featured === 'true') where.isFeatured = true;
    if (q.size) where.variants = { some: { size: q.size, stock: { gt: 0 } } };
    if (q.minPrice || q.maxPrice)
      where.price = { gte: q.minPrice ? +q.minPrice : undefined, lte: q.maxPrice ? +q.maxPrice : undefined };

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      q.sort === 'price_asc' ? { price: 'asc' } : q.sort === 'price_desc' ? { price: 'desc' } : { createdAt: 'desc' };
    const page = Math.max(1, +(q.page ?? 1));
    const limit = Math.min(60, Math.max(1, +(q.limit ?? 12)));

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit, include: productInclude }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, page, pages: Math.ceil(total / limit) };
  }

  async product(slug: string) {
    const p = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        ...productInclude,
        reviews: { where: { approved: true }, include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!p) throw new NotFoundException('Product not found');
    const related = await this.prisma.product.findMany({
      where: { categoryId: p.categoryId, id: { not: p.id }, isActive: true },
      take: 4,
      include: productInclude,
    });
    const rating = p.reviews.length ? p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length : 0;
    return { ...p, rating, related };
  }

  async create(d: ProductDto) {
    const { images = [], variants = [], ...rest } = d;
    return this.prisma.product.create({
      data: {
        ...rest,
        slug: `${slugify(d.name)}-${Date.now().toString(36)}`,
        images: { create: images.map((url, position) => ({ url, position })) },
        variants: { create: variants },
      },
      include: productInclude,
    });
  }

  async update(id: string, d: Partial<ProductDto>) {
    const { images, variants, ...rest } = d;
    return this.prisma.$transaction(async (tx) => {
      if (images) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        await tx.productImage.createMany({ data: images.map((url, position) => ({ productId: id, url, position })) });
      }
      if (variants) {
        // Upsert by size/color so existing cart and order references stay valid.
        for (const v of variants)
          await tx.productVariant.upsert({
            where: { productId_size_color: { productId: id, size: v.size, color: v.color } },
            update: { stock: v.stock },
            create: { ...v, productId: id },
          });
      }
      return tx.product.update({ where: { id }, data: rest, include: productInclude });
    });
  }

  async remove(id: string) {
    // Soft-delete so past orders keep their product reference.
    await this.prisma.product.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  }

  createCategory(name: string, image?: string, parentId?: string) {
    return this.prisma.category.create({ data: { name, slug: slugify(name), image, parentId } });
  }

  async removeCategory(id: string) {
    await this.prisma.category.delete({ where: { id } });
    return { ok: true };
  }
}
