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

  // FORMS: create, edit, roles, or null
  const [mode, setMode] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  const [form, setForm] = useState({ ...emptyForm });
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);

  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [notice, setNotice] = useState("");

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

  // 3. Protect the current user and Super Admin accounts.
  const isProtectedUser = (target) => {
    const isSelf = target.id === currentUser?.id;

    const isSuperAdmin = target.roles?.some(
      (role) => role.name === "Super Admin",
    );

    return isSelf || isSuperAdmin;
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

  const closeForm = () => {
    if (saving) return;

    setMode(null);
    setSelectedUser(null);
    setForm({ ...emptyForm });
    setSelectedRoleIds([]);
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

  return (
    <div className="usr-page">
      {/* PAGE HEADER */}
      <div className="usr-heading">
        <div>
          <h1>Users Management</h1>
          <p>
            Create users, edit account details, and manage their assigned roles.
          </p>
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

                            {!canUpdate && !canAssign && (
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
