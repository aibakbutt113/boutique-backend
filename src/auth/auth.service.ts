import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto, RegisterDto } from './auth.dto.js';

@Injectable()
export class AuthService {
  private log = new Logger('Auth');
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  private async tokens(user: { id: string; email: string; role: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload, { expiresIn: '15m' }),
      refreshToken: await this.jwt.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh',
        expiresIn: '30d',
      }),
    };
  }

  private publicUser(u: { id: string; email: string; name: string; role: string; phone: string | null }) {
    return { id: u.id, email: u.email, name: u.name, role: u.role, phone: u.phone };
  }

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } }))
      throw new ConflictException('Email already registered');
    const user = await this.prisma.user.create({
      data: { email, name: dto.name, phone: dto.phone, passwordHash: await bcrypt.hash(dto.password, 10) },
    });
    return { user: this.publicUser(user), ...(await this.tokens(user)) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash)))
      throw new UnauthorizedException('Invalid email or password');
    return { user: this.publicUser(user), ...(await this.tokens(user)) };
  }

  async refresh(refreshToken: string) {
    try {
      const p = await this.jwt.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh',
      });
      const user = await this.prisma.user.findUnique({ where: { id: p.sub } });
      if (!user) throw new Error();
      return { user: this.publicUser(user), ...(await this.tokens(user)) };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async forgot(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user) {
      const token = randomBytes(24).toString('hex');
      await this.prisma.user.update({
        where: { id: user.id },
        data: { resetToken: token, resetExpires: new Date(Date.now() + 3600_000) },
      });
      // No mail transport configured: log the link for development.
      this.log.log(`Password reset link: ${process.env.FRONTEND_URL}/reset-password?token=${token}`);
    }
    return { message: 'If that email exists, a reset link has been sent.' };
  }

  async reset(token: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { resetToken: token, resetExpires: { gt: new Date() } },
    });
    if (!user) throw new BadRequestException('Reset link is invalid or expired');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(password, 10), resetToken: null, resetExpires: null },
    });
    return { message: 'Password updated' };
  }
}
