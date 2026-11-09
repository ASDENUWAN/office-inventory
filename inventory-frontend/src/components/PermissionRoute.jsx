import { Link, Outlet } from "react-router";
import { useAuth } from "../context/AuthContext";

export default function PermissionRoute({ permission }) {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return (
      <section className="access-denied">
        <div className="access-denied-icon">403</div>

        <h1>Access Denied</h1>

        <p>You do not have permission to access this page.</p>

        <p className="muted">Required permission: {permission}</p>

        <Link to="/dashboard" className="page-link">
          Return to Dashboard
        </Link>
      </section>
    );
  }

  return <Outlet />;
}
