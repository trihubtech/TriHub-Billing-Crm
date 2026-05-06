const MODULE_ACTIONS = {
  dashboard: ["view"],
  products: ["list", "view", "add", "edit", "delete"],
  inventory: ["list", "view", "add"],
  customers: ["list", "view", "add", "edit", "delete"],
  vendors: ["list", "view", "add", "edit", "delete"],
  invoices: ["list", "view", "add", "edit", "delete"],
  bills: ["list", "view", "add", "edit", "delete"],
  reports: ["list", "view"],
  company: ["view", "edit"],
  users: ["list", "view", "add", "edit", "delete"],
};

function buildPermissionKey(action, moduleKey) {
  return `can_${action}_${moduleKey}`;
}

function buildModulePermissions(moduleKey) {
  return (MODULE_ACTIONS[moduleKey] || []).map((action) => buildPermissionKey(action, moduleKey));
}

const ALL_PERMISSION_KEYS = Object.keys(MODULE_ACTIONS).flatMap((moduleKey) =>
  buildModulePermissions(moduleKey)
);

const LEGACY_PERMISSION_EXPANSIONS = {
  can_view_dashboard: buildModulePermissions("dashboard"),
  can_manage_products: buildModulePermissions("products"),
  can_manage_inventory: buildModulePermissions("inventory"),
  can_manage_customers: buildModulePermissions("customers"),
  can_manage_vendors: buildModulePermissions("vendors"),
  can_manage_invoices: buildModulePermissions("invoices"),
  can_manage_bills: buildModulePermissions("bills"),
  can_view_reports: buildModulePermissions("reports"),
  can_manage_company: buildModulePermissions("company"),
  can_manage_users: buildModulePermissions("users"),
};

function expandPermissionKey(permissionKey) {
  if (LEGACY_PERMISSION_EXPANSIONS[permissionKey]) {
    return LEGACY_PERMISSION_EXPANSIONS[permissionKey];
  }

  if (ALL_PERMISSION_KEYS.includes(permissionKey)) {
    return [permissionKey];
  }

  return [];
}

export function getEffectivePermissions(user) {
  const rawPermissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return [...new Set(rawPermissions.flatMap((permissionKey) => expandPermissionKey(permissionKey)))];
}

export function hasPermission(user, permissionKey) {
  if (!permissionKey) return true;
  if (user?.is_platform_admin) return true;
  return getEffectivePermissions(user).includes(permissionKey);
}

export function hasAnyPermission(user, permissionKeys = []) {
  if (!permissionKeys.length) return true;
  if (user?.is_platform_admin) return true;
  const effectivePermissions = getEffectivePermissions(user);
  return permissionKeys.some((permissionKey) => effectivePermissions.includes(permissionKey));
}
