import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import api from "../api/axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  // Check whether the browser already has
  // an authenticated Laravel session.
  const refreshUser = useCallback(async () => {
    try {
      const response = await api.get("/api/me");

      setSession(response.data);
      setAuthError("");

      return response.data;
    } catch (error) {
      setSession(null);

      if (error.response?.status === 401) {
        // No active login session.
        setAuthError("");
      } else {
        setAuthError("Cannot verify your session. Check the Laravel server.");
      }

      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Run once when the application starts.
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Log in with email and password.
  const login = async (email, password) => {
    // 1. Get Sanctum CSRF cookie.
    await api.get("/sanctum/csrf-cookie");

    // 2. Send login credentials.
    const response = await api.post("/api/login", {
      email,
      password,
    });

    // 3. Store the returned user information.
    setSession(response.data);
    setAuthError("");

    return response.data;
  };

  // End the Laravel session.
  const logout = async () => {
    await api.post("/api/logout");

    setSession(null);
    setAuthError("");
  };

  // Used to check permissions in components.
  const hasPermission = (permission) => {
    if (!session) return false;

    if (session.is_super_admin) return true;

    return session.permissions?.includes(permission) ?? false;
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        roles: session?.roles ?? [],
        permissions: session?.permissions ?? [],
        loading,
        authError,
        login,
        logout,
        refreshUser,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Reusable hook for accessing authentication data.
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
