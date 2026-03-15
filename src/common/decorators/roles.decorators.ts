import { SetMetadata } from '@nestjs/common';

// Key ini harus sama dengan yang dipanggil di RolesGuard (reflector.get)
export const ROLES_KEY = 'roles';

// Decorator ini menerima banyak string (spread operator)
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
