import { Routes, Route, Navigate } from "react-router";

import ProtectedRoute from "./components/ProtectedRoute";
import PermissionRoute from "./components/PermissionRoute";
import DashboardLayout from "./components/DashboardLayout";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ModulePlaceholder from "./pages/ModulePlaceholder";

import UsersPage from "./pages/UsersPage";

import CategoryTypesPage from "./pages/CategoryTypesPage";
import CategoriesPage from "./pages/CategoriesPage";

import ItemsPage from "./pages/ItemsPage";

export default function App() {
  return (
    <Routes>
      {/* Public page */}
      <Route path="/login" element={<LoginPage />} />

      {/* Authenticated pages */}
      <Route element={<ProtectedRoute />}>
        {/* Shared Dashboard layout */}
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Inventory Items */}
          <Route element={<PermissionRoute permission="items.view" />}>
            <Route path="/items" element={<ItemsPage />} />
          </Route>

          {/* Categories */}
          <Route element={<PermissionRoute permission="categories.view" />}>
            <Route path="/categories" element={<CategoriesPage />} />
          </Route>

          {/* Category Types */}
          <Route
            element={<PermissionRoute permission="category-types.manage" />}
          >
            <Route path="/category-types" element={<CategoryTypesPage />} />
          </Route>

          {/* User Management */}
          <Route element={<PermissionRoute permission="users.view" />}>
            <Route path="/users" element={<UsersPage />} />
          </Route>

          {/* Role Management */}
          <Route element={<PermissionRoute permission="roles.view" />}>
            <Route
              path="/roles"
              element={
                <ModulePlaceholder
                  title="Roles"
                  description="Create and manage system roles."
                  endpoint="GET /api/roles"
                />
              }
            />
          </Route>

          {/* Permission Management */}
          <Route element={<PermissionRoute permission="permissions.view" />}>
            <Route
              path="/permissions"
              element={
                <ModulePlaceholder
                  title="Permissions"
                  description="Manage application permissions."
                  endpoint="GET /api/permissions"
                />
              }
            />
          </Route>
        </Route>
      </Route>

      {/* Unknown route */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
