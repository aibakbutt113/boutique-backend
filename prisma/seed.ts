import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Images are served by the frontend placeholder route: /ph/<tone>/<label>.
const ph = (tone: string, label: string) => `/ph/${tone}/${encodeURIComponent(label)}`;

const categories = [
  { name: 'Dresses', tone: 'rose' },
  { name: 'Tops', tone: 'cream' },
  { name: 'Bottoms', tone: 'blue' },
  { name: 'Accessories', tone: 'sand' },
  { name: 'Sale', tone: 'blush' },
];

// Fictional labels (not real brands) so the "Shop by Brand" strip has more than 5 to page through.
const brands = [
  { name: 'Anaya Studio', tone: 'rose' },
  { name: 'Rosewood Atelier', tone: 'blush' },
  { name: 'Noor & Co', tone: 'cream' },
  { name: 'Mehrma Couture', tone: 'sand' },
  { name: 'Ivory Thread', tone: 'cream' },
  { name: 'Gulnar Designs', tone: 'rose' },
  { name: 'Saffron & Silk', tone: 'blush' },
];

type P = [string, string, string, number, number | null, boolean, string];
// name, category, fabric, price (PKR), salePrice, isNew, tone
const products: P[] = [
  ['Floral Lawn 3-Piece Suit', 'Dresses', 'Lawn', 6500, null, true, 'rose'],
  ['Embroidered Chiffon Kurta Set', 'Dresses', 'Chiffon', 9800, null, true, 'blush'],
  ['Pastel Cotton Frock', 'Dresses', 'Cotton', 4200, null, false, 'rose'],
  ['Chikankari Straight Shirt', 'Dresses', 'Cotton', 5400, 4500, false, 'cream'],
  ['Organza Party Wear Gown', 'Dresses', 'Organza', 14500, null, true, 'blush'],
  ['Block Print Khaddar Suit', 'Dresses', 'Khaddar', 7200, null, false, 'sand'],
  ['Digital Print Silk Kameez', 'Dresses', 'Silk', 8900, 7500, false, 'rose'],
  ['Ruffle Tiered Anarkali', 'Dresses', 'Georgette', 11200, null, true, 'blush'],
  ['Cozy Knit Kurti', 'Tops', 'Wool', 3800, null, true, 'rose'],
  ['Lace Detail Blouse', 'Tops', 'Cotton', 3600, null, false, 'cream'],
  ['Pocket Knit Cardigan', 'Tops', 'Wool', 4200, null, true, 'rose'],
  ['Embroidered Short Kurti', 'Tops', 'Lawn', 3200, 2600, false, 'blush'],
  ['Linen Boxy Shirt', 'Tops', 'Linen', 3400, null, false, 'sand'],
  ['Puff Sleeve Peplum Top', 'Tops', 'Cotton', 2900, null, false, 'cream'],
  ['High Rise Straight Jeans', 'Bottoms', 'Denim', 4800, null, true, 'blue'],
  ['Cotton Culottes', 'Bottoms', 'Cotton', 2400, null, false, 'cream'],
  ['Silk Palazzo Trousers', 'Bottoms', 'Silk', 3900, null, false, 'rose'],
  ['Straight Cigarette Pants', 'Bottoms', 'Cotton', 2600, 2100, false, 'sand'],
  ['Embroidered Shalwar', 'Bottoms', 'Lawn', 3100, null, false, 'blush'],
  ['Pearl Chiffon Dupatta', 'Accessories', 'Chiffon', 2200, null, true, 'blush'],
  ['Embroidered Velvet Shawl', 'Accessories', 'Velvet', 6800, null, false, 'rose'],
  ['Kundan Jhumka Earrings', 'Accessories', 'Alloy', 1800, 1400, false, 'sand'],
  ['Beaded Clutch Bag', 'Accessories', 'Fabric', 3500, null, false, 'cream'],
  ['Phulkari Dupatta', 'Accessories', 'Cotton', 2900, 2300, false, 'rose'],
];

const sizes = ['XS', 'S', 'M', 'L', 'XL'];
const colors = ['Blush', 'Ivory'];

async function main() {
  await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL ?? 'admin@boutique.pk' },
    update: {},
    create: {
      email: process.env.ADMIN_EMAIL ?? 'admin@boutique.pk',
      name: 'Boutique Admin',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD ?? 'Admin@12345', 10),
    },
  });

  // A known-password test account: created in development, but never on a production server
  // unless SEED_DEMO_CUSTOMER=true is set explicitly.
  if (process.env.NODE_ENV !== 'production' || process.env.SEED_DEMO_CUSTOMER === 'true') {
    await prisma.user.upsert({
      where: { email: 'customer@boutique.pk' },
      update: {},
      create: {
        email: 'customer@boutique.pk',
        name: 'Demo Customer',
        phone: '03001234567',
        passwordHash: await bcrypt.hash('Customer@12345', 10),
      },
    });
  }

  const catIds: Record<string, string> = {};
  for (const [position, c] of categories.entries()) {
    const cat = await prisma.category.upsert({
      where: { slug: slugify(c.name) },
      update: { position, image: ph(c.tone, '-') },
      create: { name: c.name, slug: slugify(c.name), position, image: ph(c.tone, '-') },
    });
    catIds[c.name] = cat.id;
  }

  const brandIds: string[] = [];
  for (const [position, b] of brands.entries()) {
    const brand = await prisma.brand.upsert({
      where: { slug: slugify(b.name) },
      update: { position, image: ph(b.tone, '-') },
      create: { name: b.name, slug: slugify(b.name), position, image: ph(b.tone, '-') },
    });
    brandIds.push(brand.id);
  }

  for (const [i, [name, cat, fabric, price, salePrice, isNew, tone]] of products.entries()) {
    const slug = slugify(name);
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) {
      // Backfill brandId on rows seeded before brands existed, without touching anything else.
      if (!existing.brandId) await prisma.product.update({ where: { id: existing.id }, data: { brandId: brandIds[i % brandIds.length] } });
      continue;
    }
    await prisma.product.create({
      data: {
        name, slug, fabric, price, salePrice, isNew,
        isFeatured: isNew,
        description: `${name} in soft ${fabric.toLowerCase()}. Designed for everyday elegance and festive occasions, with a comfortable fit and quality finishing.`,
        categoryId: catIds[cat],
        brandId: brandIds[i % brandIds.length],
        images: { create: [0, 1, 2].map((position) => ({ position, url: ph(tone, name) })) },
        variants: {
          create: sizes.flatMap((size) => colors.map((color) => ({ size, color, stock: 3 + Math.floor(Math.random() * 12) }))),
        },
      },
    });
  }

  for (const c of [
    { code: 'WELCOME10', type: 'PERCENT' as const, value: 10, minOrder: 2000 },
    { code: 'FLAT500', type: 'FIXED' as const, value: 500, minOrder: 6000 },
  ])
    await prisma.coupon.upsert({ where: { code: c.code }, update: {}, create: c });

  // Placeholder hero slides so the home page isn't empty before an admin uploads real photos.
  if ((await prisma.banner.count()) === 0)
    await prisma.banner.createMany({
      data: [
        { imageUrl: ph('rose', '-'), position: 0 },
        { imageUrl: ph('blush', '-'), position: 1 },
        { imageUrl: ph('cream', '-'), position: 2 },
      ],
    });

  console.log('Seeded.');
}

main().finally(() => prisma.$disconnect());
