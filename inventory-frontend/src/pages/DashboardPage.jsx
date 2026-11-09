import { Link } from "react-router";

import { useAuth } from "../context/AuthContext";
import { navigationItems } from "../config/navigation";

export default function DashboardPage() {
  const { user, roles, permissions, session, hasPermission } = useAuth();

  // Modules available to the current user.
  const accessibleModules = navigationItems.filter(
    (item) =>
      item.path !== "/dashboard" &&
      (!item.permission || hasPermission(item.permission)),
  );

  return (
    <div className="dashboard-page">
      <div className="welcome-panel">
        <h1>Welcome back, {user?.name}!</h1>

        <p>Welcome to the Office Inventory Management System.</p>
      </div>

      {/* Account summary */}
      <div className="summary-grid">
        <div className="summary-card">
          <p>Assigned Roles</p>
          <h2>{roles.length}</h2>
        </div>

        <div className="summary-card">
          <p>Available Permissions</p>
          <h2>{permissions.length}</h2>
        </div>

        <div className="summary-card">
          <p>Account Type</p>
          <h3>
            {session?.is_super_admin ? "Super Admin" : roles[0] || "No Role"}
          </h3>
        </div>
      </div>

      {/* Available modules */}
      <section className="dashboard-section">
        <h2>Available Modules</h2>

        <p className="muted">
          These modules are visible according to your permissions.
        </p>

        {accessibleModules.length === 0 ? (
          <div className="panel">
            <p>
              No management modules are currently available to your account.
            </p>
          </div>
        ) : (
          <div className="module-grid">
            {accessibleModules.map((module) => (
              <Link to={module.path} key={module.path} className="module-card">
                <span className="module-icon">{module.icon}</span>

                <h3>{module.label}</h3>

                <p>Open {module.label.toLowerCase()} module</p>

                <span className="module-arrow">View module →</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
