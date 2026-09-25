import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, type AuthUser } from '../common/auth.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrdersService } from './orders.service.js';
import {
  AddressDto, CartSyncDto, CreateOrderDto, ProfileDto, ReturnDto, ReviewDto, SubscribeDto, ValidateCouponDto,
} from './shop.dto.js';

const cartInclude = {
  product: { include: { images: { orderBy: { position: 'asc' }, take: 1 } } },
  variant: true,
} as const;

@Controller()
export class ShopController {
  constructor(private prisma: PrismaService, private orders: OrdersService) {}

  // ---- newsletter & shipping (public) ----
  @Post('newsletter')
  async subscribe(@Body() d: SubscribeDto) {
    await this.prisma.subscriber.upsert({ where: { email: d.email.toLowerCase() }, update: {}, create: { email: d.email.toLowerCase() } });
    return { message: 'Thanks for subscribing!' };
  }

  @Get('shipping/rates')
  rates() {
    return {
      flat: +(process.env.FLAT_SHIPPING ?? 250),
      freeThreshold: +(process.env.FREE_SHIPPING_THRESHOLD ?? 5000),
    };
  }

  // ---- profile & addresses ----
  @Get('me') @UseGuards(JwtAuthGuard)
  me(@CurrentUser() u: AuthUser) {
    return this.prisma.user.findUnique({
      where: { id: u.id },
      select: { id: true, email: true, name: true, phone: true, role: true, addresses: true },
    });
  }

  @Patch('me') @UseGuards(JwtAuthGuard)
  updateMe(@CurrentUser() u: AuthUser, @Body() d: ProfileDto) {
    return this.prisma.user.update({ where: { id: u.id }, data: d, select: { id: true, email: true, name: true, phone: true, role: true } });
  }

  @Post('me/addresses') @UseGuards(JwtAuthGuard)
  async addAddress(@CurrentUser() u: AuthUser, @Body() d: AddressDto) {
    if (d.isDefault) await this.prisma.address.updateMany({ where: { userId: u.id }, data: { isDefault: false } });
    return this.prisma.address.create({ data: { ...d, userId: u.id } });
  }

  @Delete('me/addresses/:id') @UseGuards(JwtAuthGuard)
  async delAddress(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.prisma.address.deleteMany({ where: { id, userId: u.id } });
    return { ok: true };
  }

  // ---- cart (server copy of the client cart, replaced wholesale) ----
  @Get('cart') @UseGuards(JwtAuthGuard)
  cart(@CurrentUser() u: AuthUser) {
    return this.prisma.cartItem.findMany({ where: { userId: u.id }, include: cartInclude });
  }

  @Put('cart') @UseGuards(JwtAuthGuard)
  async syncCart(@CurrentUser() u: AuthUser, @Body() d: CartSyncDto) {
    const merged = new Map<string, number>();
    for (const i of d.items) merged.set(i.variantId, (merged.get(i.variantId) ?? 0) + i.quantity);
    const variants = await this.prisma.productVariant.findMany({ where: { id: { in: [...merged.keys()] } } });
    await this.prisma.$transaction([
      this.prisma.cartItem.deleteMany({ where: { userId: u.id } }),
      this.prisma.cartItem.createMany({
        data: variants.map((v) => ({
          userId: u.id, variantId: v.id, productId: v.productId, quantity: Math.min(merged.get(v.id)!, Math.max(v.stock, 1)),
        })),
      }),
    ]);
    return this.cart(u);
  }

  // ---- wishlist ----
  @Get('wishlist') @UseGuards(JwtAuthGuard)
  wishlist(@CurrentUser() u: AuthUser) {
    return this.prisma.wishlistItem.findMany({
      where: { userId: u.id },
      include: { product: { include: { images: { orderBy: { position: 'asc' } }, variants: true, category: true } } },
    });
  }

  @Post('wishlist/:productId') @UseGuards(JwtAuthGuard)
  async addWish(@CurrentUser() u: AuthUser, @Param('productId') productId: string) {
    await this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: u.id, productId } }, update: {}, create: { userId: u.id, productId },
    });
    return { ok: true };
  }

  @Delete('wishlist/:productId') @UseGuards(JwtAuthGuard)
  async delWish(@CurrentUser() u: AuthUser, @Param('productId') productId: string) {
    await this.prisma.wishlistItem.deleteMany({ where: { userId: u.id, productId } });
    return { ok: true };
  }

  // ---- reviews (verified buyers only) ----
  @Post('products/:id/reviews') @UseGuards(JwtAuthGuard)
  async review(@CurrentUser() u: AuthUser, @Param('id') productId: string, @Body() d: ReviewDto) {
    const bought = await this.prisma.orderItem.findFirst({
      where: { productId, order: { userId: u.id, status: 'DELIVERED' } },
    });
    if (!bought) throw new BadRequestException('Only customers who received this product can review it');
    return this.prisma.review.upsert({
      where: { userId_productId: { userId: u.id, productId } },
      update: d,
      create: { ...d, userId: u.id, productId },
    });
  }

  // ---- orders ----
  @Post('coupons/validate') @UseGuards(JwtAuthGuard)
  async coupon(@Body() d: ValidateCouponDto) {
    const r = await this.orders.validateCoupon(d.code, d.subtotal);
    return { code: r.coupon.code, discount: r.discount };
  }

  @Post('orders') @UseGuards(JwtAuthGuard)
  createOrder(@CurrentUser() u: AuthUser, @Body() d: CreateOrderDto) { return this.orders.create(u.id, d); }

  @Get('orders') @UseGuards(JwtAuthGuard)
  myOrders(@CurrentUser() u: AuthUser) { return this.orders.mine(u.id); }

  @Get('orders/:id') @UseGuards(JwtAuthGuard)
  order(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.orders.one(u.id, id); }

  @Post('orders/:id/cancel') @UseGuards(JwtAuthGuard)
  cancel(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.orders.cancel(u.id, id); }

  @Post('orders/:id/return') @UseGuards(JwtAuthGuard)
  ret(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: ReturnDto) {
    return this.orders.requestReturn(u.id, id, d.reason);
  }

  @Post('orders/:id/pay') @UseGuards(JwtAuthGuard)
  pay(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: { success?: boolean }) {
    return this.orders.mockPay(u.id, id, d?.success !== false);
  }
}
