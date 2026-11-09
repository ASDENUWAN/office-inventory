import { useState } from "react";
import { useNavigate } from "react-router";

import { useAuth } from "../context/AuthContext";

export default function DashboardPage() {
  const { user, roles, permissions, session, logout, hasPermission } =
    useAuth();

  const navigate = useNavigate();

  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setError("");
    setLoggingOut(true);

    try {
      await logout();

      navigate("/login", {
        replace: true,
      });
    } catch {
      setError("Logout failed. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <main className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <h1>Office Inventory</h1>
          <p className="muted">Management Dashboard</p>
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="secondary-button"
        >
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </header>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      <section className="panel">
        <h2>Welcome, {user?.name}!</h2>

        <p>
          <strong>Email:</strong> {user?.email}
        </p>

        <p>
          <strong>Roles:</strong> {roles.join(", ") || "None"}
        </p>

        <p>
          <strong>Super Admin:</strong> {session?.is_super_admin ? "Yes" : "No"}
        </p>
      </section>

      <section className="panel">
        <h2>Your Permissions</h2>

        <p className="muted">Permissions returned by Laravel.</p>

        {permissions.length === 0 ? (
          <p>No permissions assigned.</p>
        ) : (
          <div className="permission-list">
            {permissions.map((permission) => (
              <span className="permission-badge" key={permission}>
                {permission}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Permission Check Examples</h2>

        <div className="permission-checks">
          <p>
            Create Items:{" "}
            <strong>
              {hasPermission("items.create") ? "Allowed" : "Not Allowed"}
            </strong>
          </p>

          <p>
            Delete Items:{" "}
            <strong>
              {hasPermission("items.delete") ? "Allowed" : "Not Allowed"}
            </strong>
          </p>

          <p>
            Create Roles:{" "}
            <strong>
              {hasPermission("roles.create") ? "Allowed" : "Not Allowed"}
            </strong>
          </p>

          <p>
            Assign User Roles:{" "}
            <strong>
              {hasPermission("users.assign-roles") ? "Allowed" : "Not Allowed"}
            </strong>
          </p>
        </div>
      </section>
    </main>
  );
}
