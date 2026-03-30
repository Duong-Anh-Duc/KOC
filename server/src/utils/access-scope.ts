import { PermissionService } from '../modules/permissions/permission.service';
import { AuthenticatedRequest } from '../types';

export interface AccessScope {
  adminId?: string;
  allowedKocIds?: string[];
}

/**
 * Resolve the access scope for the authenticated user.
 * - ADMIN: scoped to their own KOCs via admin_id
 * - ACCOUNTANT: scoped to KOCs granted via ManagerKocAccess
 * - Others: no additional scoping
 */
export async function getAccessScope(req: AuthenticatedRequest): Promise<AccessScope> {
  const user = req.user;
  if (!user) return {};

  if (user.role === 'ADMIN') {
    return { adminId: user.userId };
  }

  if (user.role === 'ACCOUNTANT') {
    const access = await PermissionService.getManagerAccessDetail(user.userId);
    return { allowedKocIds: access.accessible_koc_ids };
  }

  return {};
}

/**
 * Check if a single KOC ID is accessible in the given scope.
 * Returns true if no restrictions or if kocId is in allowedKocIds.
 */
export function isKocAccessible(kocId: string, scope: AccessScope): boolean {
  if (scope.allowedKocIds) {
    return scope.allowedKocIds.includes(kocId);
  }
  // For ADMIN, koc-level check is done in the service via admin_id
  return true;
}

/**
 * Build a Prisma-compatible KOC filter from access scope.
 * Use in `prisma.kOC.findMany({ where: { ...buildKocWhereFilter(scope) } })`
 */
export function buildKocWhereFilter(scope: AccessScope): Record<string, any> {
  if (scope.adminId) return { admin_id: scope.adminId };
  if (scope.allowedKocIds) return { id: { in: scope.allowedKocIds } };
  return {};
}
