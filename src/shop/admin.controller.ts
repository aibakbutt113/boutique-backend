import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles, RolesGuard } from '../common/auth.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrdersService } from './orders.service.js';
import { CouponDto, StatusDto } from './shop.dto.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private prisma: PrismaService, private orders: OrdersService) {}

  @Get('stats')
  async stats() {
    const [revenue, orders, customers, products, pending, lowStock, recent] = await Promise.all([
      this.prisma.order.aggregate({ _sum: { total: true }, where: { status: { notIn: ['CANCELLED', 'RETURNED'] } } }),
      this.prisma.order.count(),
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.order.count({ where: { status: 'PENDING' } }),
      this.prisma.productVariant.findMany({
        where: { stock: { lte: 3 }, product: { isActive: true } },
        include: { product: { select: { name: true } } }, take: 10, orderBy: { stock: 'asc' },
      }),
      this.prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 5, include: { user: { select: { name: true } } } }),
    ]);
    return { revenue: revenue._sum.total ?? 0, orders, customers, products, pending, lowStock, recent };
  }

  @Get('orders')
  allOrders() {
    return this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' }, include: { items: true, user: { select: { name: true, email: true } } },
    });
  }

  @Patch('orders/:id/status')
  status(@Param('id') id: string, @Body() d: StatusDto) { return this.orders.setStatus(id, d.status); }

  @Get('customers')
  customers() {
    return this.prisma.user.findMany({
      where: { role: 'CUSTOMER' }, orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, phone: true, createdAt: true, _count: { select: { orders: true } } },
    });
  }

  @Get('coupons') coupons() { return this.prisma.coupon.findMany(); }

  @Post('coupons')
  createCoupon(@Body() d: CouponDto) {
    return this.prisma.coupon.create({
      data: { ...d, code: d.code.trim().toUpperCase(), expiresAt: d.expiresAt ? new Date(d.expiresAt) : undefined },
    });
  }

  @Delete('coupons/:id')
  async delCoupon(@Param('id') id: string) {
    await this.prisma.coupon.update({ where: { id }, data: { active: false } });
    return { ok: true };
  }

  @Get('reviews')
  reviews() {
    return this.prisma.review.findMany({
      orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true } }, product: { select: { name: true } } },
    });
  }

  @Delete('reviews/:id')
  async delReview(@Param('id') id: string) {
    await this.prisma.review.delete({ where: { id } });
    return { ok: true };
  }

  @Get('subscribers') subscribers() { return this.prisma.subscriber.findMany({ orderBy: { createdAt: 'desc' } }); }
}
