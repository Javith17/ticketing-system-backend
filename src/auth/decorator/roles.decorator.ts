import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Marks a route as restricted to the given role codes (RoleEntity.role_code).
 * Read by RolesGuard (src/auth/guard/roles.guard.ts) off request.user.roleCode,
 * which AuthGuard populates from the JWT payload.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
