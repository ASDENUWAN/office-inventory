import { useState } from "react";
import { Navigate, useNavigate } from "react-router";

import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { session, loading, login } = useAuth();

  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSubmitting(true);

    try {
      await login(email, password);

      navigate("/dashboard", {
        replace: true,
      });
    } catch (err) {
      const status = err.response?.status;

      if (status === 422) {
        setError("Invalid email or password.");
      } else if (status === 419) {
        setError("Security session expired. Please try again.");
      } else if (status === 429) {
        setError("Too many login attempts. Please try later.");
      } else {
        setError("Login failed. Check your Laravel connection.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p>Checking authentication...</p>;
  }

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <main className="center-page">
      <div className="panel login-panel">
        <div className="brand-mark">OI</div>

        <h1>Office Inventory</h1>

        <p className="muted">Sign in to manage your inventory.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="primary-button"
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}
