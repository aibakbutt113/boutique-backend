import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CatalogController } from './catalog/catalog.controller.js';
import { CatalogService } from './catalog/catalog.service.js';
import { ShopController } from './shop/shop.controller.js';
import { AdminController } from './shop/admin.controller.js';
import { UPLOAD_DIR, UploadController } from './shop/upload.controller.js';
import { OrdersService } from './shop/orders.service.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ServeStaticModule.forRoot({ rootPath: UPLOAD_DIR, serveRoot: '/uploads' }),
  ],
  controllers: [CatalogController, ShopController, AdminController, UploadController],
  providers: [CatalogService, OrdersService],
})
export class AppModule {}
