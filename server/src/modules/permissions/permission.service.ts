import prisma from '../../config/database';

// All available KOC-level permissions (mirrors what Admin can do)
export const KOC_PERMISSIONS = {
  // === Basic (view) ===
  view_info: { label: 'permissions.koc_view_info', group: 'basic' },
  view_revenue: { label: 'permissions.koc_view_revenue', group: 'basic' },
  view_monthly: { label: 'permissions.koc_view_monthly', group: 'basic' },
  view_payment_status: { label: 'permissions.koc_view_payment_status', group: 'basic' },
  view_stats: { label: 'permissions.koc_view_stats', group: 'basic' },
  view_yt_data: { label: 'permissions.koc_view_yt_data', group: 'basic' },
  view_audit: { label: 'permissions.koc_view_audit', group: 'basic' },
  // === Advanced (edit/action) ===
  edit_info: { label: 'permissions.koc_edit_info', group: 'advanced' },
  create_revenue: { label: 'permissions.koc_create_revenue', group: 'advanced' },
  edit_revenue: { label: 'permissions.koc_edit_revenue', group: 'advanced' },
  delete_revenue: { label: 'permissions.koc_delete_revenue', group: 'advanced' },
  approve_revenue: { label: 'permissions.koc_approve_revenue', group: 'advanced' },
  manage_cycle: { label: 'permissions.koc_manage_cycle', group: 'advanced' },
  send_email: { label: 'permissions.koc_send_email', group: 'advanced' },
  run_scraper: { label: 'permissions.koc_run_scraper', group: 'advanced' },
  create_revenue_from_scrape: { label: 'permissions.koc_create_revenue_from_scrape', group: 'advanced' },
} as const;

export type KocPermission = keyof typeof KOC_PERMISSIONS;

export const ALL_KOC_PERMISSIONS: KocPermission[] = Object.keys(KOC_PERMISSIONS) as KocPermission[];

// Default = only basic (view) permissions
export const DEFAULT_KOC_PERMISSIONS: KocPermission[] = [
  'view_info', 'view_revenue', 'view_monthly', 'view_payment_status',
  'view_stats', 'view_yt_data', 'view_audit',
];

export interface KocAccessEntry {
  koc_id: string;
  permissions: KocPermission[];
}

export class PermissionService {
  /**
   * Get full manager → KOC access map with per-KOC permissions
   * Returns: { "manager-id": [{ koc_id, permissions }, ...] }
   */
  static async getManagerKocAccess(adminId?: string): Promise<Record<string, KocAccessEntry[]>> {
    // If adminId provided, only return access entries for KOCs owned by this admin
    const kocFilter = adminId
      ? { koc: { admin_id: adminId } }
      : {};
    const rows = await prisma.managerKocAccess.findMany({
      where: kocFilter,
      select: { manager_id: true, koc_id: true, permissions: true },
    });

    const map: Record<string, KocAccessEntry[]> = {};
    for (const row of rows) {
      if (!map[row.manager_id]) map[row.manager_id] = [];
      map[row.manager_id].push({
        koc_id: row.koc_id,
        permissions: (row.permissions as KocPermission[]) || ALL_KOC_PERMISSIONS,
      });
    }
    return map;
  }

  /**
   * Toggle a KOC on/off for a manager.
   * When toggling ON, grants all permissions by default.
   */
  static async toggleKocAccess(
    managerId: string,
    kocId: string,
    enabled: boolean
  ): Promise<void> {
    const manager = await prisma.user.findFirst({
      where: { id: managerId, role: 'ACCOUNTANT', is_active: true },
    });
    if (!manager) throw new Error('Manager not found');

    if (enabled) {
      await prisma.managerKocAccess.upsert({
        where: { manager_id_koc_id: { manager_id: managerId, koc_id: kocId } },
        update: {},
        create: {
          manager_id: managerId,
          koc_id: kocId,
          permissions: DEFAULT_KOC_PERMISSIONS,
        },
      });
    } else {
      await prisma.managerKocAccess.deleteMany({
        where: { manager_id: managerId, koc_id: kocId },
      });
    }
  }

  /**
   * Update the detailed permissions for a specific manager + KOC pair
   */
  static async updateKocPermissions(
    managerId: string,
    kocId: string,
    permissions: KocPermission[]
  ): Promise<void> {
    // Validate permissions
    const invalid = permissions.filter((p) => !ALL_KOC_PERMISSIONS.includes(p));
    if (invalid.length > 0) {
      throw new Error(`Invalid permissions: ${invalid.join(', ')}`);
    }

    await prisma.managerKocAccess.update({
      where: { manager_id_koc_id: { manager_id: managerId, koc_id: kocId } },
      data: { permissions },
    });
  }

  /**
   * Bulk toggle: select/deselect all KOCs for a manager
   */
  static async bulkToggleKocAccess(
    managerId: string,
    kocIds: string[],
    enabled: boolean
  ): Promise<void> {
    const manager = await prisma.user.findFirst({
      where: { id: managerId, role: 'ACCOUNTANT', is_active: true },
    });
    if (!manager) throw new Error('Manager not found');

    if (enabled && kocIds.length > 0) {
      // Delete existing then insert all
      await prisma.$transaction([
        prisma.managerKocAccess.deleteMany({ where: { manager_id: managerId } }),
        prisma.managerKocAccess.createMany({
          data: kocIds.map((kocId) => ({
            manager_id: managerId,
            koc_id: kocId,
            permissions: DEFAULT_KOC_PERMISSIONS,
          })),
          skipDuplicates: true,
        }),
      ]);
    } else {
      await prisma.managerKocAccess.deleteMany({ where: { manager_id: managerId } });
    }
  }

  /**
   * Get which KOC IDs a specific manager can view
   */
  static async getAccessibleKocIds(managerId: string): Promise<string[]> {
    const rows = await prisma.managerKocAccess.findMany({
      where: { manager_id: managerId },
      select: { koc_id: true },
    });
    return rows.map((r) => r.koc_id);
  }

  /**
   * Get full access detail for a manager:
   * - per_koc: { kocId: permissions[] }
   * - aggregated: union of all permissions across KOCs (for sidebar/menu visibility)
   */
  static async getManagerAccessDetail(managerId: string) {
    const rows = await prisma.managerKocAccess.findMany({
      where: { manager_id: managerId },
      select: { koc_id: true, permissions: true },
    });

    const perKoc: Record<string, string[]> = {};
    const aggregated = new Set<string>();

    for (const row of rows) {
      const perms = (row.permissions as string[]) || [];
      perKoc[row.koc_id] = perms;
      for (const p of perms) aggregated.add(p);
    }

    return {
      accessible_koc_ids: rows.map((r) => r.koc_id),
      per_koc: perKoc,
      aggregated: Array.from(aggregated),
    };
  }

  /**
   * Get all manager users (ACCOUNTANT role = Quản lý)
   */
  static async getManagerUsers() {
    return prisma.user.findMany({
      where: { role: 'ACCOUNTANT', is_active: true },
      select: { id: true, full_name: true, email: true },
      orderBy: { full_name: 'asc' },
    });
  }

  /**
   * Get all active KOCs
   */
  static async getKocList(adminId?: string) {
    return prisma.kOC.findMany({
      where: { status: 'ACTIVE', ...(adminId ? { admin_id: adminId } : {}) },
      select: {
        id: true,
        full_name: true,
        channel_name: true,
        admin_id: true,
        admin: { select: { full_name: true } },
      },
      orderBy: { full_name: 'asc' },
    });
  }

  /**
   * Get KOC permission definitions (for frontend)
   */
  static getKocPermissionDefinitions() {
    return Object.entries(KOC_PERMISSIONS).map(([key, val]) => ({
      key,
      label: val.label,
      group: val.group,
    }));
  }
}
