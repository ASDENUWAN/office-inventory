import { Routes, Route, Navigate } from "react-router";

import ProtectedRoute from "./components/ProtectedRoute";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";

export default function App() {
  return (
    <Routes>
      {/* Public login page */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route path="/dashboard" element={<DashboardPage />} />
      </Route>

      {/* Unknown URLs */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
