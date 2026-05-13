

import { useEffect, useState } from "react";
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Sidebar from "./components/Layout/Sidebar";
import Navbar from "./components/Layout/Navbar";


import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Subscribe from "./pages/auth/Subscribe";
import SetPassword from "./pages/auth/SetPassword";


import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Inventory from "./pages/Inventory";
import Customers from "./pages/Customers";
import Vendors from "./pages/Vendors";
import Invoices from "./pages/Invoices";
import Bills from "./pages/Bills";
import Reports from "./pages/Reports";
import GstReports from "./pages/GstReports";
import Profile from "./pages/Profile";
import Team from "./pages/Team";
import Chat from "./pages/Chat";
import AdminPanel from "./pages/admin/AdminPanel";


import InvoiceForm from "./components/Invoice/InvoiceForm";
import InvoicePrint from "./components/Invoice/InvoicePrint";
import BillForm from "./components/Bill/BillForm";
import BillPrint from "./components/Bill/BillPrint";
import { hasPermission } from "./utils/permissions";


function AuthGuard() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-dark">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" style={{ width: "3rem", height: "3rem" }} />
          <div className="text-light fw-medium">Loading TriHub…</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <Outlet />;
}

function SubscriptionGuard() {
  const { user } = useAuth();

  
  if (user?.is_platform_admin) return <Outlet />;

  if (user?.sub_status && user.sub_status !== "ACTIVE") {
    return <Navigate to="/subscribe" replace />;
  }

  return <Outlet />;
}

function AdminGuard() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user?.is_platform_admin) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function PermissionGuard({ permission, permissions = [] }) {
  const { user, loading } = useAuth();
  const requiredPermissions = permission ? [permission] : permissions;

  if (loading) return null;
  if (requiredPermissions.every((permissionKey) => hasPermission(user, permissionKey))) {
    return <Outlet />;
  }
  return <Navigate to="/dashboard" replace />;
}

function MustChangePasswordGuard() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user?.must_change_password) {
    return <Navigate to="/set-password" replace />;
  }
  return <Outlet />;
}


function ProtectedLayout() {
  const location = useLocation();
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("trihub_sidebar_collapsed") === "1";
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem("trihub_sidebar_collapsed", desktopCollapsed ? "1" : "0");
  }, [desktopCollapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 992) {
        setMobileOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("sidebar-mobile-open", mobileOpen);

    return () => {
      document.body.classList.remove("sidebar-mobile-open");
    };
  }, [mobileOpen]);

  return (
    <div
      className={`app-layout${desktopCollapsed ? " sidebar-collapsed" : ""}${mobileOpen ? " sidebar-mobile-visible" : ""}`}
    >
      <Sidebar
        collapsed={desktopCollapsed}
        mobileOpen={mobileOpen}
        onToggleCollapsed={() => setDesktopCollapsed((current) => !current)}
        onOpenDesktop={() => setDesktopCollapsed(false)}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="app-main">
        <Navbar
          desktopCollapsed={desktopCollapsed}
          mobileOpen={mobileOpen}
          onToggleDesktopSidebar={() => setDesktopCollapsed((current) => !current)}
          onToggleMobileSidebar={() => setMobileOpen((current) => !current)}
        />
        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function GuestGuard() {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return null;
  if (isAuthenticated) {
    return <Navigate to={user?.is_platform_admin ? "/admin" : "/dashboard"} replace />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      {}
      <Route element={<GuestGuard />}>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<Register />} />
      </Route>
      <Route path="/subscribe" element={<Subscribe />} />

      {}
      <Route element={<AuthGuard />}>
        <Route path="/set-password" element={<SetPassword />} />
        <Route element={<MustChangePasswordGuard />}>
          <Route element={<SubscriptionGuard />}>
            <Route element={<ProtectedLayout />}>
              <Route element={<PermissionGuard permission="can_view_dashboard" />}>
                <Route path="/dashboard" element={<Dashboard />} />
              </Route>
              <Route element={<PermissionGuard permission="can_list_products" />}>
                <Route path="/products" element={<Products />} />
              </Route>
              <Route element={<PermissionGuard permission="can_list_inventory" />}>
                <Route path="/inventory" element={<Inventory />} />
              </Route>
              <Route element={<PermissionGuard permission="can_list_customers" />}>
                <Route path="/customers" element={<Customers />} />
              </Route>
              <Route element={<PermissionGuard permission="can_list_vendors" />}>
                <Route path="/vendors" element={<Vendors />} />
              </Route>
              <Route element={<PermissionGuard permission="can_list_invoices" />}>
                <Route path="/invoices" element={<Invoices />} />
              </Route>
              <Route element={<PermissionGuard permissions={["can_add_invoices", "can_list_customers", "can_list_products"]} />}>
                <Route path="/invoices/new" element={<InvoiceForm />} />
              </Route>
              <Route element={<PermissionGuard permissions={["can_edit_invoices", "can_list_customers", "can_list_products"]} />}>
                <Route path="/invoices/:id/edit" element={<InvoiceForm />} />
              </Route>
              <Route element={<PermissionGuard permission="can_view_invoices" />}>
                <Route path="/invoices/:id/view" element={<InvoicePrint />} />
              </Route>
              <Route element={<PermissionGuard permission="can_list_bills" />}>
                <Route path="/bills" element={<Bills />} />
              </Route>
              <Route element={<PermissionGuard permissions={["can_add_bills", "can_list_vendors", "can_list_products"]} />}>
                <Route path="/bills/new" element={<BillForm />} />
              </Route>
              <Route element={<PermissionGuard permissions={["can_edit_bills", "can_list_vendors", "can_list_products"]} />}>
                <Route path="/bills/:id/edit" element={<BillForm />} />
              </Route>
              <Route element={<PermissionGuard permission="can_view_bills" />}>
                <Route path="/bills/:id/view" element={<BillPrint />} />
              </Route>
              <Route element={<PermissionGuard permission="can_list_reports" />}>
                <Route path="/reports" element={<Reports />} />
              </Route>
              <Route element={<PermissionGuard permission="can_view_reports" />}>
                <Route path="/reports/gst" element={<GstReports />} />
              </Route>
              <Route path="/profile" element={<Profile />} />
              <Route path="/chat" element={<Chat />} />
              <Route element={<PermissionGuard permission="can_list_users" />}>
                <Route path="/team" element={<Team />} />
              </Route>
              <Route element={<AdminGuard />}>
                <Route path="/admin" element={<AdminPanel />} />
              </Route>
            </Route>
          </Route>
        </Route>
      </Route>

      {}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
