import { useEffect, useState } from "react";
import axios from "axios";

import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

import "../styles/roles.css";

function getErrorMessage(error) {
  if (!error.response) {
    return "Cannot connect to Laravel. Check the backend server.";
  }

  const status = error.response.status;

  if (status === 401) {
    return "Your session has expired. Please log in again.";
  }

  if (status === 403) {
    return (
      error.response.data?.message ||
      "You do not have permission for this action."
    );
  }

  if (status === 404) {
    return "Role not found. Refresh the page.";
  }

  if (status === 409) {
    return error.response.data?.message || "This role is currently in use.";
  }

  if (status === 419) {
    return "Security session expired. Refresh and retry.";
  }

  return (
    error.response.data?.message || "Something went wrong. Please try again."
  );
}

export default function RolesPage() {
  const { hasPermission, refreshUser } = useAuth();

  const canCreate = hasPermission("roles.create");
  const canUpdate = hasPermission("roles.update");
  const canDelete = hasPermission("roles.delete");

  const canAssign = canUpdate && hasPermission("permissions.assign");

  // ROLE LIST
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");

  // ASSIGNABLE PERMISSIONS
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [permissionsLoading, setPermissionsLoading] = useState(canAssign);
  const [permissionsError, setPermissionsError] = useState("");

  // FORM STATE
  // mode: "create", "edit", "permissions" or null
  const [mode, setMode] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);

  const [roleName, setRoleName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState([]);

  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // DELETE AND FEEDBACK
  const [deletingId, setDeletingId] = useState(null);
  const [notice, setNotice] = useState("");

  // 1. Fetch roles when the page loads or refreshes.
  useEffect(() => {
    const controller = new AbortController();

    async function fetchRoles() {
      setLoading(true);
      setListError("");

      try {
        const response = await api.get("/api/roles", {
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setRoles(response.data.data);
        }
      } catch (error) {
        if (!controller.signal.aborted && !axios.isCancel(error)) {
          setRoles([]);
          setListError(getErrorMessage(error));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchRoles();

    return () => controller.abort();
  }, [reloadKey]);

  // 2. Fetch permissions the user may assign.
  useEffect(() => {
    if (!canAssign) {
      setAvailablePermissions([]);
      setPermissionsLoading(false);
      setPermissionsError("");
      return;
    }

    const controller = new AbortController();

    async function fetchPermissions() {
      setPermissionsLoading(true);
      setPermissionsError("");

      try {
        const response = await api.get("/api/roles/assignable-permissions", {
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setAvailablePermissions(response.data.data);
        }
      } catch (error) {
        if (!controller.signal.aborted && !axios.isCancel(error)) {
          setAvailablePermissions([]);
          setPermissionsError(getErrorMessage(error));
        }
      } finally {
        if (!controller.signal.aborted) {
          setPermissionsLoading(false);
        }
      }
    }

    fetchPermissions();

    return () => controller.abort();
  }, [canAssign, reloadKey]);

  const refreshRoles = () => {
    setReloadKey((previous) => previous + 1);
  };

  // 3. Open Create Role form.
  const openCreate = () => {
    if (!canCreate) return;

    setMode("create");
    setSelectedRole(null);
    setRoleName("");
    setSelectedPermissions([]);
    setFormErrors({});
    setFormError("");
    setNotice("");
  };

  // 4. Open Edit Role form.
  const openEdit = (role) => {
    if (!canUpdate || !role.can_manage) return;

    setMode("edit");
    setSelectedRole(role);
    setRoleName(role.name);
    setFormErrors({});
    setFormError("");
    setNotice("");
  };

  // 5. Open Permission Assignment form.
  const openPermissions = (role) => {
    if (
      !canAssign ||
      !role.can_manage ||
      permissionsLoading ||
      permissionsError
    ) {
      return;
    }

    const allowedNames = new Set(
      availablePermissions.map((permission) => permission.name),
    );

    // Prevent accidentally removing permissions
    // the current Admin cannot manage.
    const unauthorizedExisting = role.permissions.filter(
      (name) => !allowedNames.has(name),
    );

    if (unauthorizedExisting.length > 0) {
      setListError(
        "This role contains permissions outside your " +
          "grant authority. Ask Super Admin to manage it.",
      );
      return;
    }

    setMode("permissions");
    setSelectedRole(role);
    setSelectedPermissions([...role.permissions]);
    setFormErrors({});
    setFormError("");
    setNotice("");
  };

  // Close the active form.
  const closeForm = () => {
    setMode(null);
    setSelectedRole(null);
    setRoleName("");
    setSelectedPermissions([]);
    setFormErrors({});
    setFormError("");
  };

  // 6. Create or rename a role.
  const handleRoleSubmit = async (event) => {
    event.preventDefault();

    if (saving) return;

    if (mode === "create" && !canCreate) return;

    if (mode === "edit" && (!canUpdate || !selectedRole?.can_manage)) {
      return;
    }

    setSaving(true);
    setFormErrors({});
    setFormError("");
    setNotice("");

    const payload = {
      name: roleName.trim(),
    };

    try {
      if (mode === "create") {
        await api.post("/api/roles", payload);
      } else if (mode === "edit" && selectedRole) {
        await api.patch(`/api/roles/${selectedRole.id}`, payload);
      } else {
        return;
      }

      const wasCreate = mode === "create";

      closeForm();
      refreshRoles();

      // A renamed role might belong to the current user.
      await refreshUser();

      setNotice(
        wasCreate
          ? "Role created successfully. You can assign permissions next."
          : "Role updated successfully.",
      );
    } catch (error) {
      if (error.response?.status === 422 && error.response?.data?.errors) {
        setFormErrors(error.response.data.errors);
      } else {
        setFormError(getErrorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  };

  // 7. Select or unselect a permission.
  const togglePermission = (name) => {
    setSelectedPermissions((previous) =>
      previous.includes(name)
        ? previous.filter((item) => item !== name)
        : [...previous, name],
    );
  };

  const selectAllPermissions = () => {
    setSelectedPermissions(
      availablePermissions.map((permission) => permission.name),
    );
  };

  const clearPermissions = () => {
    setSelectedPermissions([]);
  };

  // 8. Save permissions for the selected role.
  const handlePermissionSubmit = async (event) => {
    event.preventDefault();

    if (
      !canAssign ||
      !selectedRole?.can_manage ||
      mode !== "permissions" ||
      saving
    ) {
      return;
    }

    setSaving(true);
    setFormErrors({});
    setFormError("");
    setNotice("");

    try {
      await api.put(`/api/roles/${selectedRole.id}/permissions`, {
        permissions: selectedPermissions,
      });

      closeForm();
      refreshRoles();

      // Refresh effective permissions in React.
      await refreshUser();

      setNotice("Role permissions updated successfully.");
    } catch (error) {
      if (error.response?.status === 422 && error.response?.data?.errors) {
        setFormErrors(error.response.data.errors);
      } else {
        setFormError(getErrorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  };

  // 9. Delete an unused regular role.
  const handleDelete = async (role) => {
    if (!canDelete || !role.can_manage || deletingId !== null) {
      return;
    }

    const confirmed = window.confirm(
      `Permanently delete the "${role.name}" role?\n\n` +
        "Roles assigned to users cannot be deleted.",
    );

    if (!confirmed) return;

    setDeletingId(role.id);
    setListError("");
    setNotice("");

    try {
      await api.delete(`/api/roles/${role.id}`);

      refreshRoles();

      setNotice("Role deleted successfully.");
    } catch (error) {
      setListError(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  // 10. Search locally through the loaded role list.
  const filteredRoles = roles.filter((role) => {
    const query = search.trim().toLowerCase();

    return (
      role.name.toLowerCase().includes(query) ||
      role.permissions.some((permission) =>
        permission.toLowerCase().includes(query),
      )
    );
  });

  // Group permission checkboxes by their prefix.
  // Example: items.view and items.create -> "items".
  const groupedPermissions = availablePermissions.reduce(
    (groups, permission) => {
      const group = permission.name.split(".")[0];

      if (!groups[group]) {
        groups[group] = [];
      }

      groups[group].push(permission);

      return groups;
    },
    {},
  );

  const isRoleForm = mode === "create" || mode === "edit";

  return (
    <div className="rl-page">
      {/* PAGE HEADER */}
      <div className="rl-heading">
        <div>
          <h1>Roles Management</h1>
          <p>Create roles and control access through permissions.</p>
        </div>

        <div className="rl-heading-actions">
          <button
            type="button"
            className="rl-btn"
            onClick={refreshRoles}
            disabled={loading}
          >
            Refresh
          </button>

          {canCreate && (
            <button
              type="button"
              className="rl-btn rl-btn-primary"
              onClick={openCreate}
            >
              + Create Role
            </button>
          )}
        </div>
      </div>

      {/* FEEDBACK */}
      {notice && (
        <div className="rl-alert rl-success" role="status">
          {notice}
        </div>
      )}

      {listError && (
        <div className="rl-alert rl-error" role="alert">
          {listError}
        </div>
      )}

      {permissionsError && (
        <div className="rl-alert rl-error" role="alert">
          Cannot load permission options: {permissionsError}
        </div>
      )}

      {/* CREATE / EDIT ROLE */}
      {isRoleForm && (
        <section className="rl-card">
          <div className="rl-card-heading">
            <h2>{mode === "create" ? "Create New Role" : "Edit Role"}</h2>

            <button
              type="button"
              className="rl-close"
              onClick={closeForm}
              disabled={saving}
              aria-label="Close form"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleRoleSubmit}>
            <div className="rl-field">
              <label htmlFor="rl-name">Role Name</label>

              <input
                id="rl-name"
                value={roleName}
                onChange={(event) => {
                  setRoleName(event.target.value);
                  setFormErrors({});
                }}
                placeholder="e.g. Stock Controller"
                minLength={2}
                maxLength={80}
                required
              />

              {formErrors.name?.[0] && (
                <small className="rl-field-error">{formErrors.name[0]}</small>
              )}
            </div>

            <p className="rl-help">
              Use a descriptive name such as Inventory Manager, Editor, Viewer,
              or Stock Controller. The name Super Admin is reserved.
            </p>

            {formError && (
              <div className="rl-alert rl-error" role="alert">
                {formError}
              </div>
            )}

            <div className="rl-form-actions">
              <button
                type="button"
                className="rl-btn"
                disabled={saving}
                onClick={closeForm}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="rl-btn rl-btn-primary"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : mode === "create"
                    ? "Create Role"
                    : "Update Role"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* PERMISSION ASSIGNMENT FORM */}
      {mode === "permissions" && selectedRole && (
        <section className="rl-card">
          <div className="rl-card-heading">
            <div>
              <h2>Manage Role Permissions</h2>
              <p>
                Role: <strong>{selectedRole.name}</strong>
              </p>
            </div>

            <button
              type="button"
              className="rl-close"
              onClick={closeForm}
              disabled={saving}
              aria-label="Close permissions form"
            >
              ×
            </button>
          </div>

          <p className="rl-help">
            Select all permissions this role should have. Saving replaces the
            role's complete permission list.
          </p>

          <div className="rl-selection-toolbar">
            <span>{selectedPermissions.length} selected</span>

            <div className="rl-toolbar-actions">
              <button
                type="button"
                className="rl-btn rl-btn-small"
                onClick={selectAllPermissions}
                disabled={saving}
              >
                Select All Available
              </button>

              <button
                type="button"
                className="rl-btn rl-btn-small"
                onClick={clearPermissions}
                disabled={saving}
              >
                Clear All
              </button>
            </div>
          </div>

          <form onSubmit={handlePermissionSubmit}>
            {availablePermissions.length === 0 ? (
              <div className="rl-empty">
                No assignable permissions are available.
              </div>
            ) : (
              <div className="rl-permission-groups">
                {Object.entries(groupedPermissions).map(
                  ([group, permissions]) => (
                    <div className="rl-permission-group" key={group}>
                      <h3>{group}</h3>

                      <div className="rl-checkbox-grid">
                        {permissions.map((permission) => (
                          <label className="rl-checkbox" key={permission.id}>
                            <input
                              type="checkbox"
                              checked={selectedPermissions.includes(
                                permission.name,
                              )}
                              onChange={() => togglePermission(permission.name)}
                              disabled={saving}
                            />

                            <span>{permission.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}

            {Object.keys(formErrors).length > 0 && (
              <div className="rl-alert rl-error" role="alert">
                {Object.values(formErrors).flat().join(" ")}
              </div>
            )}

            {formError && (
              <div className="rl-alert rl-error" role="alert">
                {formError}
              </div>
            )}

            <p className="rl-help">
              Selecting no permissions removes all existing role permissions.
              Laravel will check your authority before saving.
            </p>

            <div className="rl-form-actions">
              <button
                type="button"
                className="rl-btn"
                onClick={closeForm}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="rl-btn rl-btn-primary"
                disabled={saving || permissionsLoading}
              >
                {saving ? "Saving..." : "Save Permissions"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ROLE LIST */}
      <section className="rl-card">
        <div className="rl-card-heading">
          <div>
            <h2>All Roles</h2>
            <p>{roles.length} registered roles</p>
          </div>
        </div>

        <div className="rl-search">
          <label htmlFor="rl-search-input">Search Roles</label>

          <input
            id="rl-search-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or permission..."
          />
        </div>

        {loading ? (
          <div className="rl-empty">Loading roles...</div>
        ) : listError && roles.length === 0 ? (
          <div className="rl-empty">Unable to load roles.</div>
        ) : filteredRoles.length === 0 ? (
          <div className="rl-empty">No matching roles found.</div>
        ) : (
          <div className="rl-table-wrapper">
            <table className="rl-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Permissions</th>
                  <th>Permission Count</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredRoles.map((role) => {
                  const protectedRole = role.name === "Super Admin";

                  const manageable = Boolean(role.can_manage);

                  return (
                    <tr key={role.id}>
                      <td>
                        <strong>{role.name}</strong>

                        <small className="rl-id">Role #{role.id}</small>

                        {protectedRole && (
                          <span className="rl-protected">System role</span>
                        )}
                      </td>

                      <td>
                        {protectedRole ? (
                          <span className="rl-help">All via Laravel Gate</span>
                        ) : role.permissions.length === 0 ? (
                          <span className="rl-help">No permissions</span>
                        ) : (
                          <div className="rl-badges">
                            {role.permissions.map((permission) => (
                              <span
                                className="rl-permission-badge"
                                key={permission}
                              >
                                {permission}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td>{protectedRole ? "All" : role.permissions.length}</td>

                      <td>
                        {!manageable ? (
                          <span className="rl-protected">
                            {protectedRole ? "Protected" : "Restricted"}
                          </span>
                        ) : (
                          <div className="rl-row-actions">
                            {canUpdate && (
                              <button
                                type="button"
                                className="rl-btn rl-btn-small"
                                onClick={() => openEdit(role)}
                              >
                                Edit
                              </button>
                            )}

                            {canAssign && (
                              <button
                                type="button"
                                className="rl-btn rl-btn-small rl-btn-permissions"
                                onClick={() => openPermissions(role)}
                                disabled={
                                  permissionsLoading ||
                                  Boolean(permissionsError)
                                }
                              >
                                Permissions
                              </button>
                            )}

                            {canDelete && (
                              <button
                                type="button"
                                className="rl-btn rl-btn-small rl-btn-danger"
                                onClick={() => handleDelete(role)}
                                disabled={deletingId !== null}
                              >
                                {deletingId === role.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            )}

                            {!canUpdate && !canAssign && !canDelete && (
                              <span className="rl-help">View only</span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
