import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";

import { useAuth } from "../context/AuthContext";
import { navigationItems } from "../config/navigation";

import "../styles/dashboard.css";

export default function DashboardLayout() {
  const { user, roles, hasPermission, logout } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  // Only show navigation items the user can access.
  const visibleItems = navigationItems.filter(
    (item) => !item.permission || hasPermission(item.permission),
  );

  const currentPage = navigationItems.find(
    (item) => item.path === location.pathname,
  );

  const handleLogout = async () => {
    setLogoutError("");
    setLoggingOut(true);

    try {
      await logout();
      navigate("/login", { replace: true });
    } catch {
      setLogoutError("Logout failed. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="app-shell">
      {/* Mobile sidebar overlay */}
      {menuOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`app-sidebar ${menuOpen ? "is-open" : ""}`}
        aria-label="Main navigation"
      >
        <div className="sidebar-brand">
          <div className="sidebar-logo">OI</div>

          <div>
            <strong>Office Inventory</strong>
            <small>Management System</small>
          </div>
        </div>

        <nav className="sidebar-navigation">
          {["Workspace", "Administration"].map((group) => {
            const items = visibleItems.filter((item) => item.group === group);

            if (items.length === 0) return null;

            return (
              <div className="sidebar-section" key={group}>
                <p className="sidebar-section-title">{group}</p>

                {items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `sidebar-link ${isActive ? "is-active" : ""}`
                    }
                  >
                    <span className="sidebar-icon" aria-hidden="true">
                      {item.icon}
                    </span>

                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <span className="sidebar-avatar">
            {user?.name?.charAt(0).toUpperCase()}
          </span>

          <div className="sidebar-user-info">
            <strong>{user?.name}</strong>
            <small>{roles.join(", ") || "No role"}</small>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="app-content">
        {/* Top header */}
        <header className="app-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation"
              aria-expanded={menuOpen}
            >
              ☰
            </button>

            <h2>{currentPage?.label || "Dashboard"}</h2>
          </div>

          <div className="topbar-right">
            <span className="topbar-username">{user?.name}</span>

            <button
              type="button"
              className="topbar-logout"
              disabled={loggingOut}
              onClick={handleLogout}
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </header>

        {logoutError && (
          <p className="layout-error" role="alert">
            {logoutError}
          </p>
        )}

        {/* Current page is rendered here */}
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
