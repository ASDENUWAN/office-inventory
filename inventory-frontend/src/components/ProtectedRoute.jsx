import { Navigate, Outlet } from "react-router";

import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { session, loading, authError, refreshUser } = useAuth();

  // Wait until Laravel session is checked.
  if (loading) {
    return <p>Checking authentication...</p>;
  }

  // Handle a server or connection problem.
  if (authError) {
    return (
      <main className="center-page">
        <div className="panel">
          <h2>Connection problem</h2>
          <p>{authError}</p>

          <button onClick={refreshUser}>Try Again</button>
        </div>
      </main>
    );
  }

  // Redirect guests to the Login page.
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Render the protected page.
  return <Outlet />;
}
