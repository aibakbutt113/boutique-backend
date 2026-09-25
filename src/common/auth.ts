import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Optional,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard, AuthModuleOptions } from '@nestjs/passport';

export interface AuthUser {
  id: string;
  email: string;
  role: 'CUSTOMER' | 'ADMIN';
}

// The explicit optional constructor param is needed: under ESM the mixin's own
// injection metadata isn't picked up by subclasses.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(@Optional() @Inject(AuthModuleOptions) options?: AuthModuleOptions) {
    super(options);
  }
}

/** Attaches the user when a valid token is present but never rejects. */
@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  constructor(@Optional() @Inject(AuthModuleOptions) options?: AuthModuleOptions) {
    super(options);
  }
  handleRequest<T>(_err: unknown, user: T): T {
    return user;
  }
}

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>('roles', ctx.getHandler()) ??
      this.reflector.get<string[]>('roles', ctx.getClass());
    if (!roles) return true;
    const user = ctx.switchToHttp().getRequest().user as AuthUser | undefined;
    return !!user && roles.includes(user.role);
  }
}

export const CurrentUser = createParamDecorator((_d, ctx: ExecutionContext) =>
  ctx.switchToHttp().getRequest().user as AuthUser,
);
