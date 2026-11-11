import { useEffect, useState } from "react";
import axios from "axios";

import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

import "../styles/users.css";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  password_confirmation: "",
};

const emptyMeta = {
  current_page: 1,
  last_page: 1,
  per_page: 10,
  total: 0,
};

function getErrorMessage(error) {
  if (!error.response) {
    return "Cannot connect to Laravel. Check the backend.";
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
    return "User or role not found. Refresh the page.";
  }

  if (status === 419) {
    return "Security session expired. Refresh and retry.";
  }

  return (
    error.response.data?.message || "Something went wrong. Please try again."
  );
}

export default function UsersPage() {
  const { user: currentUser, hasPermission } = useAuth();

  const canCreate = hasPermission("users.create");
  const canUpdate = hasPermission("users.update");
  const canAssign = hasPermission("users.assign-roles");
  const canAssignDirect = hasPermission("users.assign-permissions");

  // USER LIST
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(emptyMeta);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // ASSIGNABLE ROLE OPTIONS
  const [assignableRoles, setAssignableRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(canAssign);
  const [rolesError, setRolesError] = useState("");

  // FORMS: create, edit, roles, permissions, or null
  const [mode, setMode] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  const [form, setForm] = useState({ ...emptyForm });
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);

  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [notice, setNotice] = useState("");

  const [directPermissionOptions, setDirectPermissionOptions] = useState([]);

  const [directPermissionsLoading, setDirectPermissionsLoading] =
    useState(canAssignDirect);

  const [directPermissionsError, setDirectPermissionsError] = useState("");

  const [selectedDirectPermissions, setSelectedDirectPermissions] = useState(
    [],
  );

  useEffect(() => {
    if (!canAssignDirect) {
      setDirectPermissionOptions([]);
      setDirectPermissionsLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadDirectPermissionOptions() {
      setDirectPermissionsLoading(true);
      setDirectPermissionsError("");

      try {
        const response = await api.get("/api/users/assignable-permissions", {
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setDirectPermissionOptions(response.data.data);
        }
      } catch (error) {
        if (!controller.signal.aborted && !axios.isCancel(error)) {
          setDirectPermissionsError(getErrorMessage(error));
        }
      } finally {
        if (!controller.signal.aborted) {
          setDirectPermissionsLoading(false);
        }
      }
    }

    loadDirectPermissionOptions();

    return () => controller.abort();
  }, [canAssignDirect]);

  // 1. Load users when page changes or data is refreshed.
  useEffect(() => {
    const controller = new AbortController();

    async function fetchUsers() {
      setLoading(true);
      setListError("");

      try {
        const response = await api.get("/api/users", {
          params: { page },
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setUsers(response.data.data);
          setMeta(response.data.meta);
        }
      } catch (error) {
        if (!controller.signal.aborted && !axios.isCancel(error)) {
          setUsers([]);
          setListError(getErrorMessage(error));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchUsers();

    return () => controller.abort();
  }, [page, reloadKey]);

  // 2. Load roles that the current user may assign.
  useEffect(() => {
    if (!canAssign) {
      setAssignableRoles([]);
      setRolesLoading(false);
      return;
    }

    const controller = new AbortController();

    async function fetchRoles() {
      setRolesLoading(true);
      setRolesError("");

      try {
        const response = await api.get("/api/users/assignable-roles", {
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setAssignableRoles(response.data.data);
        }
      } catch (error) {
        if (!controller.signal.aborted && !axios.isCancel(error)) {
          setAssignableRoles([]);
          setRolesError(getErrorMessage(error));
        }
      } finally {
        if (!controller.signal.aborted) {
          setRolesLoading(false);
        }
      }
    }

    fetchRoles();

    return () => controller.abort();
  }, [canAssign]);

  const refreshUsers = () => {
    setReloadKey((previous) => previous + 1);
  };

  // Protect self, Super Admin, and accounts outside this user's authority.
  const isProtectedUser = (target) => {
    const isSelf = Number(target.id) === Number(currentUser?.id);
    const isSuperAdmin = target.roles?.some(
      (role) => role.name === "Super Admin",
    );

    return isSelf || isSuperAdmin || target.can_manage === false;
  };

  // 4. Open Create User form.
  const openCreate = () => {
    if (!canCreate) return;

    setMode("create");
    setSelectedUser(null);
    setForm({ ...emptyForm });
    setFormErrors({});
    setFormError("");
    setNotice("");
  };

  // 5. Open Edit User form.
  const openEdit = (target) => {
    if (!canUpdate || isProtectedUser(target)) return;

    setMode("edit");
    setSelectedUser(target);

    setForm({
      name: target.name,
      email: target.email,
      password: "",
      password_confirmation: "",
    });

    setFormErrors({});
    setFormError("");
    setNotice("");
  };

  // 6. Open Role Assignment form.
  const openRoles = (target) => {
    if (!canAssign || rolesLoading || rolesError || isProtectedUser(target)) {
      return;
    }

    // If the target has a role outside the available
    // options, do not let this form silently remove it.
    const hasUnassignableRole = target.roles.some(
      (role) => !assignableRoles.some((option) => option.id === role.id),
    );

    if (hasUnassignableRole) {
      setListError(
        "This account has a role beyond your assignment " +
          "authority. Ask Super Admin to manage it.",
      );
      return;
    }

    setMode("roles");
    setSelectedUser(target);

    setSelectedRoleIds(target.roles.map((role) => role.id));

    setFormErrors({});
    setFormError("");
    setNotice("");
  };

  const openDirectPermissions = (target) => {
    if (
      !canAssignDirect ||
      isProtectedUser(target) ||
      directPermissionsLoading ||
      directPermissionsError
    ) {
      return;
    }

    // The updated UserController must return inherited permissions.
    // Never assume they are empty if the backend has not been updated.
    if (!Array.isArray(target.inherited_permissions)) {
      setListError(
        "Inherited permissions are missing from the API. " +
          "Update UserController::formatUser() and refresh.",
      );
      return;
    }

    const existing = target.direct_permissions ?? [];

    const allowedNames = new Set(
      directPermissionOptions.map((permission) => permission.name),
    );

    // Prevent the form from silently removing
    // a permission outside the actor's authority.
    const hasRestrictedPermission = existing.some(
      (name) => !allowedNames.has(name),
    );

    if (hasRestrictedPermission) {
      setListError(
        "This user has direct permissions outside your " +
          "grant authority. Ask Super Admin to manage them.",
      );
      return;
    }

    setMode("permissions");
    setSelectedUser(target);

    setSelectedDirectPermissions([...existing]);

    setFormErrors({});
    setFormError("");
    setListError("");
    setNotice("");
  };

  const closeForm = () => {
    // Buttons are disabled while saving. Internal success handlers
    // must still be able to close the form before saving becomes false.
    setMode(null);
    setSelectedUser(null);
    setForm({ ...emptyForm });
    setSelectedRoleIds([]);
    setSelectedDirectPermissions([]);
    setFormErrors({});
    setFormError("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setFormErrors((previous) => ({
      ...previous,
      [name]: undefined,
    }));
  };

  // 7. Create or update a user.
  const handleUserSubmit = async (event) => {
    event.preventDefault();

    if (saving) return;

    if (mode === "create" && !canCreate) return;
    if (mode === "edit" && !canUpdate) return;

    setSaving(true);
    setFormErrors({});
    setFormError("");
    setNotice("");

    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
    };

    if (mode === "create") {
      payload.password = form.password;
      payload.password_confirmation = form.password_confirmation;
    }

    try {
      if (mode === "create") {
        await api.post("/api/users", payload);
      } else if (mode === "edit" && selectedUser) {
        await api.patch(`/api/users/${selectedUser.id}`, payload);
      } else {
        return;
      }

      const wasCreate = mode === "create";

      closeForm();

      if (wasCreate && page !== 1) {
        setPage(1);
      } else {
        refreshUsers();
      }

      setNotice(
        wasCreate
          ? "User created successfully. Assign a role next."
          : "User details updated successfully.",
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

  // 8. Select or unselect a role.
  const toggleRole = (roleId) => {
    setSelectedRoleIds((previous) =>
      previous.includes(roleId)
        ? previous.filter((id) => id !== roleId)
        : [...previous, roleId],
    );
  };

  // 9. Save the complete role selection.
  const handleRoleSubmit = async (event) => {
    event.preventDefault();

    if (!canAssign || !selectedUser || mode !== "roles" || saving) {
      return;
    }

    // Removing all roles is a significant operation.
    if (selectedRoleIds.length === 0 && selectedUser.roles.length > 0) {
      const confirmed = window.confirm(
        `Remove all roles from "${selectedUser.name}"?`,
      );

      if (!confirmed) return;
    }

    setSaving(true);
    setFormErrors({});
    setFormError("");
    setNotice("");

    try {
      await api.put(`/api/users/${selectedUser.id}/roles`, {
        roles: selectedRoleIds,
      });

      closeForm();
      refreshUsers();

      setNotice("User roles updated successfully.");
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

  const fieldError = (name) => formErrors[name]?.[0];

  const toggleDirectPermission = (name) => {
    setSelectedDirectPermissions((previous) =>
      previous.includes(name)
        ? previous.filter((item) => item !== name)
        : [...previous, name],
    );
  };

  const handleDirectPermissionSubmit = async (event) => {
    event.preventDefault();

    if (
      !canAssignDirect ||
      !selectedUser ||
      mode !== "permissions" ||
      saving ||
      directPermissionsLoading ||
      directPermissionsError
    ) {
      return;
    }

    const existing = selectedUser.direct_permissions ?? [];

    if (selectedDirectPermissions.length === 0 && existing.length > 0) {
      const confirmed = window.confirm(
        `Remove all direct permissions from "${selectedUser.name}"?`,
      );

      if (!confirmed) return;
    }

    setSaving(true);
    setFormError("");
    setFormErrors({});
    setNotice("");

    try {
      await api.put(`/api/users/${selectedUser.id}/permissions`, {
        permissions: selectedDirectPermissions,
      });

      closeForm();
      refreshUsers();

      setNotice("Direct user permissions updated successfully.");
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

  // Merge assignable permissions with all inherited permissions.
  // Inherited permissions must remain visible even if the current Admin
  // does not have authority to grant them directly.
  const inheritedPermissionNames = new Set(
    selectedUser?.inherited_permissions ?? [],
  );

  const shownPermissionNames = Array.from(
    new Set([
      ...directPermissionOptions.map((permission) => permission.name),
      ...(selectedUser?.inherited_permissions ?? []),
    ]),
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div className="usr-page">
      {/* PAGE HEADER */}
      <div className="usr-heading">
        <div>
          <h1>Users Management</h1>
          <p>Create users, assign roles, and manage direct permissions.</p>
        </div>

        <div className="usr-heading-actions">
          <button
            type="button"
            className="usr-btn"
            onClick={refreshUsers}
            disabled={loading}
          >
            Refresh
          </button>

          {canCreate && (
            <button
              type="button"
              className="usr-btn usr-btn-primary"
              onClick={openCreate}
            >
              + Create User
            </button>
          )}
        </div>
      </div>

      {/* FEEDBACK */}
      {notice && (
        <div className="usr-alert usr-success" role="status">
          {notice}
        </div>
      )}

      {listError && (
        <div className="usr-alert usr-error" role="alert">
          {listError}
        </div>
      )}

      {rolesError && (
        <div className="usr-alert usr-error" role="alert">
          Unable to load assignable roles: {rolesError}
        </div>
      )}

      {/* CREATE / EDIT USER FORM */}
      {(mode === "create" || mode === "edit") && (
        <section className="usr-card">
          <div className="usr-card-heading">
            <h2>
              {mode === "create" ? "Create New User" : "Edit User Details"}
            </h2>

            <button
              type="button"
              className="usr-close"
              onClick={closeForm}
              disabled={saving}
              aria-label="Close user form"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleUserSubmit}>
            <div className="usr-form-grid">
              <div className="usr-field">
                <label htmlFor="usr-name">Full Name</label>

                <input
                  id="usr-name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  maxLength={150}
                  placeholder="e.g. Kasun Perera"
                  required
                />

                {fieldError("name") && (
                  <small className="usr-field-error">
                    {fieldError("name")}
                  </small>
                )}
              </div>

              <div className="usr-field">
                <label htmlFor="usr-email">Email Address</label>

                <input
                  id="usr-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  maxLength={255}
                  placeholder="e.g. kasun@example.com"
                  required
                />

                {fieldError("email") && (
                  <small className="usr-field-error">
                    {fieldError("email")}
                  </small>
                )}
              </div>

              {mode === "create" && (
                <>
                  <div className="usr-field">
                    <label htmlFor="usr-password">Initial Password</label>

                    <input
                      id="usr-password"
                      name="password"
                      type="password"
                      value={form.password}
                      onChange={handleChange}
                      minLength={4}
                      autoComplete="new-password"
                      required
                    />

                    {fieldError("password") && (
                      <small className="usr-field-error">
                        {fieldError("password")}
                      </small>
                    )}
                  </div>

                  <div className="usr-field">
                    <label htmlFor="usr-password-confirm">
                      Confirm Password
                    </label>

                    <input
                      id="usr-password-confirm"
                      name="password_confirmation"
                      type="password"
                      value={form.password_confirmation}
                      onChange={handleChange}
                      minLength={4}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </>
              )}
            </div>

            <p className="usr-help">
              {mode === "create"
                ? "The account starts without roles. Use Assign Roles after creating it. Share the initial password securely."
                : "This form changes only the user's name and email. Passwords and roles are managed separately."}
            </p>

            {formError && (
              <div className="usr-alert usr-error" role="alert">
                {formError}
              </div>
            )}

            <div className="usr-form-actions">
              <button
                type="button"
                className="usr-btn"
                disabled={saving}
                onClick={closeForm}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="usr-btn usr-btn-primary"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : mode === "create"
                    ? "Create User"
                    : "Update User"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ROLE ASSIGNMENT FORM */}
      {mode === "roles" && selectedUser && (
        <section className="usr-card">
          <div className="usr-card-heading">
            <div>
              <h2>Assign Roles</h2>
              <p>
                User: <strong>{selectedUser.name}</strong>
              </p>
            </div>

            <button
              type="button"
              className="usr-close"
              onClick={closeForm}
              disabled={saving}
              aria-label="Close role form"
            >
              ×
            </button>
          </div>

          <p className="usr-help">
            Select the complete set of roles for this user. Saving replaces all
            existing roles.
          </p>

          <form onSubmit={handleRoleSubmit}>
            {assignableRoles.length === 0 ? (
              <div className="usr-empty">
                No assignable roles available. Create and configure roles first.
              </div>
            ) : (
              <div className="usr-role-options">
                {assignableRoles.map((role) => (
                  <label key={role.id} className="usr-role-option">
                    <input
                      type="checkbox"
                      checked={selectedRoleIds.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                    />

                    <span>{role.name}</span>
                  </label>
                ))}
              </div>
            )}

            {Object.keys(formErrors).length > 0 && (
              <div className="usr-alert usr-error" role="alert">
                {Object.values(formErrors).flat().join(" ")}
              </div>
            )}

            {formError && (
              <div className="usr-alert usr-error" role="alert">
                {formError}
              </div>
            )}

            <p className="usr-help">
              An empty selection removes every role. The backend will reject any
              unauthorized role assignment.
            </p>

            <div className="usr-form-actions">
              <button
                type="button"
                className="usr-btn"
                onClick={closeForm}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="usr-btn usr-btn-primary"
                disabled={saving || rolesLoading || Boolean(rolesError)}
              >
                {saving ? "Saving..." : "Save Roles"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* DIRECT USER PERMISSIONS FORM */}
      {mode === "permissions" && selectedUser && (
        <section className="usr-card">
          <div className="usr-card-heading">
            <div>
              <h2>Manage User Permissions</h2>
              <p>
                User: <strong>{selectedUser.name}</strong>
              </p>
              <p className="usr-help">
                Assigned Roles:{" "}
                <strong>
                  {selectedUser.roles?.length > 0
                    ? selectedUser.roles.map((role) => role.name).join(", ")
                    : "No roles assigned"}
                </strong>
              </p>
            </div>

            <button
              type="button"
              className="usr-close"
              onClick={closeForm}
              disabled={saving}
              aria-label="Close permissions form"
            >
              ×
            </button>
          </div>

          <div className="usr-permission-note">
            <strong>Checked and locked = inherited from a role.</strong>
            <p>
              Role permissions cannot be changed here. To change those, edit the
              role in Roles Management or change the user's role.
            </p>
            <p>
              You can check or uncheck direct permissions below. Only those
              direct assignments are sent to Laravel when saving.
            </p>
          </div>

          <form onSubmit={handleDirectPermissionSubmit}>
            {directPermissionsLoading ? (
              <div className="usr-empty">Loading permission options...</div>
            ) : directPermissionsError ? (
              <div className="usr-alert usr-error" role="alert">
                {directPermissionsError}
              </div>
            ) : shownPermissionNames.length === 0 ? (
              <div className="usr-empty">
                No inherited or assignable permissions available.
              </div>
            ) : (
              <div className="usr-direct-permissions">
                {shownPermissionNames.map((name) => {
                  const inherited = inheritedPermissionNames.has(name);
                  const directlyAssigned =
                    selectedDirectPermissions.includes(name);

                  return (
                    <label
                      key={name}
                      className={`usr-role-option ${
                        inherited ? "usr-inherited-option" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={inherited || directlyAssigned}
                        disabled={saving || inherited}
                        onChange={() => toggleDirectPermission(name)}
                      />

                      <span className="usr-permission-details">
                        <strong>{name}</strong>
                        {inherited ? (
                          <small className="usr-inherited-label">
                            {directlyAssigned
                              ? "From Role + Direct (locked)"
                              : "From Role (locked)"}
                          </small>
                        ) : directlyAssigned ? (
                          <small className="usr-direct-label">
                            Direct permission — editable
                          </small>
                        ) : (
                          <small className="usr-available-label">
                            Available for direct assignment
                          </small>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {Object.keys(formErrors).length > 0 && (
              <div className="usr-alert usr-error" role="alert">
                {Object.values(formErrors).flat().join(" ")}
              </div>
            )}

            {formError && (
              <div className="usr-alert usr-error" role="alert">
                {formError}
              </div>
            )}

            <p className="usr-help">
              {selectedDirectPermissions.length} directly assigned;{" "}
              {inheritedPermissionNames.size} inherited from roles. Saving
              changes only direct permissions. If a permission is both inherited
              and directly assigned, its existing direct grant stays in place
              while that checkbox is locked.
            </p>

            <div className="usr-form-actions">
              <button
                type="button"
                className="usr-btn"
                onClick={closeForm}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="usr-btn usr-btn-primary"
                disabled={
                  saving ||
                  directPermissionsLoading ||
                  Boolean(directPermissionsError)
                }
              >
                {saving ? "Saving..." : "Save Permissions"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* USER TABLE */}
      <section className="usr-card">
        <div className="usr-card-heading">
          <div>
            <h2>All Users</h2>
            <p>{meta.total} registered user accounts</p>
          </div>
        </div>

        {loading ? (
          <div className="usr-empty">Loading users...</div>
        ) : listError && users.length === 0 ? (
          <div className="usr-empty">Unable to load users.</div>
        ) : users.length === 0 ? (
          <div className="usr-empty">No users found.</div>
        ) : (
          <div className="usr-table-wrapper">
            <table className="usr-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Assigned Roles</th>
                  <th>Direct Permissions</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {users.map((target) => {
                  const protectedAccount = isProtectedUser(target);

                  return (
                    <tr key={target.id}>
                      <td>
                        <div className="usr-person">
                          <span className="usr-avatar">
                            {target.name?.charAt(0).toUpperCase()}
                          </span>

                          <div>
                            <strong>{target.name}</strong>
                            <small>#{target.id}</small>
                          </div>
                        </div>
                      </td>

                      <td>{target.email}</td>

                      <td>
                        <div className="usr-badges">
                          {target.roles.length === 0 ? (
                            <span className="usr-no-role">No role</span>
                          ) : (
                            target.roles.map((role) => (
                              <span className="usr-role-badge" key={role.id}>
                                {role.name}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      <td>
                        <div className="usr-badges">
                          {target.direct_permissions?.length > 0 ? (
                            target.direct_permissions.map((name) => (
                              <span className="usr-direct-badge" key={name}>
                                {name}
                              </span>
                            ))
                          ) : (
                            <span className="usr-no-role">None</span>
                          )}
                        </div>
                      </td>

                      <td>
                        {target.created_at
                          ? new Date(target.created_at).toLocaleDateString()
                          : "—"}
                      </td>

                      <td>
                        {protectedAccount ? (
                          <span className="usr-protected">
                            {target.id === currentUser?.id
                              ? "Your account"
                              : "Protected"}
                          </span>
                        ) : (
                          <div className="usr-actions">
                            {canUpdate && (
                              <button
                                type="button"
                                className="usr-btn usr-btn-small"
                                onClick={() => openEdit(target)}
                              >
                                Edit
                              </button>
                            )}

                            {canAssign && (
                              <button
                                type="button"
                                className="usr-btn usr-btn-small usr-btn-role"
                                onClick={() => openRoles(target)}
                                disabled={rolesLoading || Boolean(rolesError)}
                              >
                                Assign Roles
                              </button>
                            )}

                            {canAssignDirect && (
                              <button
                                type="button"
                                className="usr-btn usr-btn-small usr-btn-role"
                                onClick={() => openDirectPermissions(target)}
                                disabled={
                                  directPermissionsLoading ||
                                  Boolean(directPermissionsError)
                                }
                              >
                                Direct Permissions
                              </button>
                            )}

                            {!canUpdate && !canAssign && !canAssignDirect && (
                              <span className="usr-help">View only</span>
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

        {/* PAGINATION */}
        <div className="usr-pagination">
          <span>
            Page {meta.current_page} of {meta.last_page}
            {" · "}
            {meta.total} users
          </span>

          <div className="usr-pagination-actions">
            <button
              type="button"
              className="usr-btn usr-btn-small"
              disabled={loading || page <= 1}
              onClick={() => setPage((previous) => previous - 1)}
            >
              Previous
            </button>

            <button
              type="button"
              className="usr-btn usr-btn-small"
              disabled={loading || page >= meta.last_page}
              onClick={() => setPage((previous) => previous + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
