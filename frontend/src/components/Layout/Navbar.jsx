

import { useAuth } from "../../context/AuthContext";
import AuthImage from "../shared/AuthImage";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import BrandLogo from "../shared/BrandLogo";
import { hasPermission } from "../../utils/permissions";


export default function Navbar({
  desktopCollapsed = false,
  mobileOpen = false,
  onToggleDesktopSidebar,
  onToggleMobileSidebar,
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
  };

  
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const canManageSubscription = !user?.is_platform_admin && hasPermission(user, "can_edit_company");

  return (
    <nav className="app-navbar" id="app-navbar">
      <div className="navbar-left">
        <button
          className="btn btn-link text-light d-lg-none navbar-hamburger"
          type="button"
          onClick={onToggleMobileSidebar}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Close sidebar" : "Open sidebar"}
        >
          <i className={`fa-solid ${mobileOpen ? "fa-xmark" : "fa-bars"} fa-lg`}></i>
        </button>

        <button
          className="btn btn-link text-light d-none d-lg-inline-flex navbar-sidebar-toggle"
          type="button"
          onClick={onToggleDesktopSidebar}
          aria-expanded={!desktopCollapsed}
          aria-label={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <i className={`fa-solid ${desktopCollapsed ? "fa-bars-staggered" : "fa-bars"} fa-lg`}></i>
        </button>
        <BrandLogo tone="light" size="sm" className="navbar-brand-lockup d-none d-lg-flex ms-2" />
      </div>

      <div className="navbar-right" ref={dropdownRef}>
        {}
        {canManageSubscription && Boolean(user?.sub_plan === "TRIAL" || (user?.sub_status && user.sub_status !== "ACTIVE")) && (
          <button
            type="button"
            className={`btn btn-sm me-2 d-none d-sm-inline-flex align-items-center ${
              user?.sub_status && user.sub_status !== "ACTIVE" ? "btn-danger-subtle text-danger-emphasis" : "btn-warning"
            }`}
            onClick={() => navigate("/subscribe")}
          >
            <i className={`fa-solid ${user?.sub_status && user.sub_status !== "ACTIVE" ? "fa-bolt" : "fa-clock"} me-1`}></i>
            {user?.sub_status && user.sub_status !== "ACTIVE" ? "Renew Plan" : "Trial"}
          </button>
        )}

        {}
        {Boolean(deferredPrompt) && (
          <button
            className="btn btn-outline-info btn-sm me-2 d-none d-md-inline-block"
            onClick={handleInstallClick}
            style={{ borderRadius: "20px", fontSize: "0.75rem", borderStyle: "dashed" }}
          >
            <i className="fa-solid fa-download me-1"></i>Install App
          </button>
        )}

        {}
        <div className="navbar-user" onClick={() => setDropdownOpen(!dropdownOpen)}>
          {user?.profile_picture ? (
            <AuthImage
              src={user.profile_picture}
              alt="Profile"
              className="rounded-circle shadow-sm"
              style={{ width: "38px", height: "38px", objectFit: "cover", border: "2px solid rgba(255,255,255,0.1)" }}
            />
          ) : (
            <div className="navbar-avatar">{initials}</div>
          )}
          <span className="navbar-username d-none d-sm-inline">{user?.name}</span>
          <i className={`fa-solid fa-chevron-down navbar-caret ${dropdownOpen ? "open" : ""}`}></i>
        </div>

        {}
        {dropdownOpen && (
          <div className="navbar-dropdown">
            <div className="navbar-dropdown-header">
              <strong>{user?.name}</strong>
              <small className="text-muted d-block">{user?.email}</small>
            </div>
            <div className="navbar-dropdown-divider"></div>
            <button
              className="navbar-dropdown-item"
              onClick={() => { navigate("/profile"); setDropdownOpen(false); }}
            >
              <i className="fa-solid fa-user me-2"></i>My Profile
            </button>

            {canManageSubscription && (
              <>
                <button
                  className="navbar-dropdown-item"
                  onClick={() => { navigate("/profile"); setDropdownOpen(false); }}
                >
                  <i className="fa-solid fa-building me-2"></i>Company Settings
                </button>
                <button
                  className="navbar-dropdown-item"
                  onClick={() => { navigate("/subscribe"); setDropdownOpen(false); }}
                >
                  <i className="fa-solid fa-credit-card me-2"></i>Subscription
                </button>
              </>
            )}
            {Boolean(user?.is_platform_admin) && (
              <button
                className="navbar-dropdown-item"
                onClick={() => { navigate("/admin"); setDropdownOpen(false); }}
              >
                <i className="fa-solid fa-shield-halved me-2"></i>Admin Panel
              </button>
            )}
            <div className="navbar-dropdown-divider"></div>
            <button className="navbar-dropdown-item text-danger" onClick={handleLogout}>
              <i className="fa-solid fa-right-from-bracket me-2"></i>Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
