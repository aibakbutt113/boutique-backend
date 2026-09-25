import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { JwtAuthGuard, Roles, RolesGuard } from '../common/auth.js';

// Serverless disks are read-only except /tmp, and /tmp is wiped between invocations:
// uploads there are temporary. Use cloud storage for real product photos in production.
export const UPLOAD_DIR = process.env.AWS_LAMBDA_FUNCTION_NAME
  ? join(tmpdir(), 'uploads')
  : join(process.cwd(), 'uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });

@Controller('admin/upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UploadController {
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_r, f, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${extname(f.originalname)}`),
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_r, f, cb) =>
        cb(f.mimetype.startsWith('image/') ? null : new BadRequestException('Images only'), f.mimetype.startsWith('image/')),
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file');
    return { url: `/uploads/${file.filename}` };
  }
}
