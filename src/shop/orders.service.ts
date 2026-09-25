import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateOrderDto } from './shop.dto.js';

const RETURN_WINDOW_DAYS = 14;

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  shippingFee(subtotal: number) {
    const threshold = +(process.env.FREE_SHIPPING_THRESHOLD ?? 5000);
    return subtotal >= threshold ? 0 : +(process.env.FLAT_SHIPPING ?? 250);
  }

  async validateCoupon(code: string, subtotal: number) {
    const c = await this.prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (!c || !c.active || (c.expiresAt && c.expiresAt < new Date()))
      throw new BadRequestException('Invalid or expired coupon');
    if (subtotal < c.minOrder) throw new BadRequestException(`Minimum order is Rs. ${c.minOrder}`);
    const discount = c.type === 'PERCENT' ? Math.round((subtotal * c.value) / 100) : Math.min(c.value, subtotal);
    return { coupon: c, discount };
  }

  async create(userId: string, dto: CreateOrderDto) {
    if (!dto.items.length) throw new BadRequestException('Cart is empty');
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: dto.items.map((i) => i.variantId) } },
      include: { product: { include: { images: { orderBy: { position: 'asc' }, take: 1 } } } },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));

    let subtotal = 0;
    const lines = dto.items.map((i) => {
      const v = byId.get(i.variantId);
      if (!v || !v.product.isActive) throw new BadRequestException('An item is no longer available');
      if (v.stock < i.quantity) throw new BadRequestException(`Only ${v.stock} left of ${v.product.name} (${v.size})`);
      const price = v.product.salePrice ?? v.product.price;
      subtotal += price * i.quantity;
      return {
        productId: v.productId, variantId: v.id, name: v.product.name, image: v.product.images[0]?.url ?? null,
        size: v.size, color: v.color, price, quantity: i.quantity,
      };
    });

    let discount = 0;
    let couponId: string | undefined;
    if (dto.couponCode) {
      const r = await this.validateCoupon(dto.couponCode, subtotal);
      discount = r.discount;
      couponId = r.coupon.id;
    }
    const shipping = this.shippingFee(subtotal - discount);
    const a = dto.address;

    return this.prisma.$transaction(async (tx) => {
      // Guarded decrement: fails if stock was taken since the check above.
      for (const l of lines) {
        const r = await tx.productVariant.updateMany({
          where: { id: l.variantId, stock: { gte: l.quantity } },
          data: { stock: { decrement: l.quantity } },
        });
        if (r.count === 0) throw new BadRequestException(`${l.name} just sold out`);
      }
      const order = await tx.order.create({
        data: {
          number: `MFB-${Date.now().toString(36).toUpperCase()}`,
          userId, paymentMethod: dto.paymentMethod, subtotal, discount, shipping,
          total: subtotal - discount + shipping, couponId,
          shipName: a.fullName, shipPhone: a.phone, shipLine1: a.line1, shipCity: a.city,
          shipProvince: a.province, shipPostal: a.postal,
          items: { create: lines },
        },
        include: { items: true },
      });
      await tx.cartItem.deleteMany({ where: { userId } });
      return order;
    });
  }

  mine(userId: string) {
    return this.prisma.order.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { items: true } });
  }

  async one(userId: string, id: string, admin = false) {
    const o = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!o) throw new NotFoundException('Order not found');
    if (!admin && o.userId !== userId) throw new ForbiddenException();
    return o;
  }

  async cancel(userId: string, id: string) {
    const o = await this.one(userId, id);
    if (!['PENDING', 'CONFIRMED'].includes(o.status)) throw new BadRequestException('Order can no longer be cancelled');
    return this.setStatus(id, 'CANCELLED');
  }

  async requestReturn(userId: string, id: string, reason: string) {
    const o = await this.one(userId, id);
    if (o.status !== 'DELIVERED' || !o.deliveredAt) throw new BadRequestException('Only delivered orders can be returned');
    if (Date.now() - o.deliveredAt.getTime() > RETURN_WINDOW_DAYS * 86400_000)
      throw new BadRequestException(`Return window of ${RETURN_WINDOW_DAYS} days has passed`);
    return this.prisma.order.update({ where: { id }, data: { status: 'RETURN_REQUESTED', returnReason: reason } });
  }

  /** Shared by customers (cancel) and admin. Restocks when the order is cancelled or returned. */
  async setStatus(id: string, status: string) {
    const o = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!o) throw new NotFoundException('Order not found');
    const restock = ['CANCELLED', 'RETURNED'].includes(status) && !['CANCELLED', 'RETURNED'].includes(o.status);
    return this.prisma.$transaction(async (tx) => {
      if (restock)
        for (const i of o.items)
          await tx.productVariant.update({ where: { id: i.variantId }, data: { stock: { increment: i.quantity } } });
      return tx.order.update({
        where: { id },
        data: {
          status: status as never,
          deliveredAt: status === 'DELIVERED' ? new Date() : undefined,
          paymentStatus: status === 'DELIVERED' && o.paymentMethod === 'COD' ? 'PAID'
            : status === 'RETURNED' && o.paymentStatus === 'PAID' ? 'REFUNDED' : undefined,
        },
        include: { items: true },
      });
    });
  }

  /** Mock wallet gateway: marks the order paid with a generated reference. */
  async mockPay(userId: string, id: string, success: boolean) {
    const o = await this.one(userId, id);
    if (o.paymentMethod === 'COD') throw new BadRequestException('Cash on delivery orders are paid on delivery');
    if (o.paymentStatus === 'PAID') return o;
    return this.prisma.order.update({
      where: { id },
      data: success
        ? { paymentStatus: 'PAID', paymentRef: `${o.paymentMethod}-${Date.now()}`, status: 'CONFIRMED' }
        : { paymentStatus: 'FAILED' },
    });
  }
}
