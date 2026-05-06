import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../utils/permissions";


const NAV_ITEMS = [
  {
    label: "Dashboard",
    icon: "fa-solid fa-gauge-high",
    path: "/dashboard",
    permission: "can_view_dashboard",
  },
  {
    label: "Stock",
    icon: "fa-solid fa-boxes-stacked",
    children: [
      { label: "Products", icon: "fa-solid fa-box", path: "/products", permission: "can_list_products" },
      { label: "Inventory", icon: "fa-solid fa-warehouse", path: "/inventory", permission: "can_list_inventory" },
    ],
  },
  {
    label: "Sales",
    icon: "fa-solid fa-chart-line",
    children: [
      { label: "Customers", icon: "fa-solid fa-users", path: "/customers", permission: "can_list_customers" },
      { label: "Invoices", icon: "fa-solid fa-file-invoice", path: "/invoices", permission: "can_list_invoices" },
    ],
  },
  {
    label: "Purchase",
    icon: "fa-solid fa-cart-shopping",
    children: [
      { label: "Vendors", icon: "fa-solid fa-truck", path: "/vendors", permission: "can_list_vendors" },
      { label: "Bills", icon: "fa-solid fa-file-invoice-dollar", path: "/bills", permission: "can_list_bills" },
    ],
  },
  {
    label: "Reports",
    icon: "fa-solid fa-chart-pie",
    path: "/reports",
    permission: "can_list_reports",
  },
  {
    label: "Team Chat",
    icon: "fa-regular fa-comments",
    path: "/chat",
  },
];

function canAccess(user, permission) {
  return hasPermission(user, permission);
}

function SidebarGroup({ item, collapsed, onNavigate, onExpandDesktop }) {
  const location = useLocation();
  const isActive = item.path
    ? location.pathname === item.path
    : item.children?.some(
      (child) =>
        location.pathname === child.path || location.pathname.startsWith(`${child.path}/`)
    );

  const [open, setOpen] = useState(Boolean(isActive));

  useEffect(() => {
    if (isActive) {
      setOpen(true);
    }
  }, [isActive]);

  if (!item.children) {
    return (
      <li className="sidebar-item">
        <NavLink
          to={item.path}
          end={item.path === "/dashboard"}
          title={collapsed ? item.label : undefined}
          onClick={onNavigate}
          className={({ isActive: navIsActive }) => `sidebar-link ${navIsActive ? "active" : ""}`}
        >
          <i className={`${item.icon} sidebar-icon`}></i>
          {!collapsed && <span>{item.label}</span>}
        </NavLink>
      </li>
    );
  }

  return (
    <li className="sidebar-item">
      <button
        type="button"
        title={collapsed ? item.label : undefined}
        className={`sidebar-link sidebar-group-toggle ${isActive ? "active" : ""}`}
        onClick={() => {
          if (collapsed) {
            onExpandDesktop?.();
            setOpen(true);
            return;
          }

          setOpen((current) => !current);
        }}
      >
        <i className={`${item.icon} sidebar-icon`}></i>
        {!collapsed && (
          <>
            <span>{item.label}</span>
          </>
        )}
      </button>

      {!collapsed && open && (
        <ul className="sidebar-submenu">
          {item.children.map((child) => (
            <li key={child.path}>
              <NavLink
                to={child.path}
                title={child.label}
                onClick={onNavigate}
                className={({ isActive: navIsActive }) =>
                  `sidebar-link sidebar-sublink ${navIsActive ? "active" : ""}`
                }
              >
                <i className={`${child.icon} sidebar-icon`}></i>
                <span>{child.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function SidebarContent({ collapsed, onNavigate, onExpandDesktop, mobile = false, onCloseMobile }) {
  const { user } = useAuth();

  if (user?.is_platform_admin) {
    const adminNavItems = [
      { label: "Admin", icon: "fa-solid fa-shield-halved", path: "/admin" },
    ];

    return (
      <>
        {mobile && (
          <div className="sidebar-header">
            <button
              type="button"
              className="sidebar-mobile-close"
              onClick={onCloseMobile}
              aria-label="Close sidebar"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}
        <nav className="sidebar-nav">
          <ul className="sidebar-menu">
            {adminNavItems.map((item) => (
              <SidebarGroup
                key={item.label}
                item={item}
                collapsed={collapsed}
                onNavigate={onNavigate}
                onExpandDesktop={onExpandDesktop}
              />
            ))}
          </ul>
        </nav>
        <div className="sidebar-footer"></div>
      </>
    );
  }

  const navItems = NAV_ITEMS
    .map((item) => {
      if (item.children) {
        const children = item.children.filter((child) => canAccess(user, child.permission));
        if (children.length === 0) return null;
        return { ...item, children };
      }

      return canAccess(user, item.permission) ? item : null;
    })
    .filter(Boolean);

  if (canAccess(user, "can_list_users")) {
    navItems.push({ label: "Team", icon: "fa-solid fa-user-group", path: "/team" });
  }

  return (
    <>
      {mobile && (
        <div className="sidebar-header">
          <button
            type="button"
            className="sidebar-mobile-close"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      <nav className="sidebar-nav">
        <ul className="sidebar-menu">
          {navItems.map((item) => (
            <SidebarGroup
              key={item.label}
              item={item}
              collapsed={collapsed}
              onNavigate={onNavigate}
              onExpandDesktop={onExpandDesktop}
            />
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
      </div>
    </>
  );
}

export default function Sidebar({
  collapsed = false,
  mobileOpen = false,
  onToggleCollapsed,
  onOpenDesktop,
  onCloseMobile,
}) {
  return (
    <>
      <aside className={`sidebar sidebar-desktop d-none d-lg-flex${collapsed ? " collapsed" : ""}`}>


        <SidebarContent
          collapsed={collapsed}
          onNavigate={undefined}
          onExpandDesktop={onOpenDesktop}
        />
      </aside>

      <button
        type="button"
        className={`sidebar-mobile-backdrop d-lg-none${mobileOpen ? " show" : ""}`}
        aria-label="Close mobile sidebar"
        onClick={onCloseMobile}
      />

      <aside className={`sidebar sidebar-mobile-panel d-lg-none${mobileOpen ? " open" : ""}`}>
        <SidebarContent
          collapsed={false}
          mobile
          onNavigate={onCloseMobile}
          onExpandDesktop={undefined}
          onCloseMobile={onCloseMobile}
        />
      </aside>
    </>
  );
}
