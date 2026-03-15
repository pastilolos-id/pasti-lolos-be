import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorators';

// 1. Buat interface khusus biar nggak ada any
interface RequestWithUser {
  user?: {
    userId: number;
    email: string;
    roles: string[];
  };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    // 2. Cast getRequest langsung ke interface kita
    // Ini buat ngilangin "Unsafe assignment of an any value"
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    // 3. Ambil user dengan aman
    const user = request.user;

    // 4. Cek keberadaan user dan roles secara eksplisit
    if (!user || !user.roles) {
      throw new ForbiddenException('Data role tidak ditemukan.');
    }

    // 5. TypeScript sekarang tahu user.roles adalah string[]
    const userRoles = Array.isArray(user.roles) ? user.roles : [];

    const hasRole = requiredRoles.some((role: string) =>
      userRoles.includes(role),
    );

    if (!hasRole) {
      throw new ForbiddenException('Akses ditolak: Role Anda tidak diizinkan.');
    }

    return true;
  }
}
// import {
//   Injectable,
//   CanActivate,
//   ExecutionContext,
//   ForbiddenException,
// } from '@nestjs/common';
// import { Reflector } from '@nestjs/core';
// import { ROLES_KEY } from '../../common/decorators/roles.decorators';

// @Injectable()
// export class RolesGuard implements CanActivate {
//   constructor(private reflector: Reflector) {}

//   canActivate(context: ExecutionContext): boolean {
//     // 1. Ambil metadata role yang diset di decorator @Roles
//     const requiredRoles = this.reflector.getAllAndOverride<string[]>(
//       ROLES_KEY,
//       [context.getHandler(), context.getClass()],
//     );

//     // 2. Jika tidak ada decorator @Roles, izinkan akses (Return #1)
//     if (!requiredRoles) {
//       return true;
//     }

//     // 3. Ambil data user dari request
//     const { user } = context.switchToHttp().getRequest();

//     // 4. Pastikan user ada dan memiliki roles (Return #2 - via Exception)
//     if (!user || !user.roles) {
//       throw new ForbiddenException('Data role tidak ditemukan.');
//     }

//     // 5. Pastikan user.roles adalah array sebelum memanggil .some
//     const userRoles: string[] = Array.isArray(user.roles) ? user.roles : [];

//     // 6. Cek apakah ada salah satu role user yang cocok
//     const hasRole = requiredRoles.some((role) => userRoles.includes(role));

//     if (!hasRole) {
//       throw new ForbiddenException('Akses ditolak: Role Anda tidak diizinkan.');
//     }

//     // 7. Jika semua pengecekan lewat, return true (Return #3)
//     return true;
//   }
// }
