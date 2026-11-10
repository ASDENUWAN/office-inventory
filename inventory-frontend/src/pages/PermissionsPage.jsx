import { useEffect, useState } from "react";
import axios from "axios";

import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

import "../styles/permissions.css";

// Convert Laravel response errors into readable text.
function getErrorMessage(error) {
  if (!error.response) {
    return "Cannot connect to Laravel. Check the backend server.";
  }

  const status = error.response.status;

  if (status === 401) {
    return "Your session expired. Please log in again.";
  }

  if (status === 403) {
    return (
      error.response.data?.message ||
      "You do not have permission for this action."
    );
  }

  if (status === 404) {
    return "Permission not found. Refresh the list.";
  }

  if (status === 409) {
    return (
      error.response.data?.message ||
      "Remove existing assignments before deletion."
    );
  }

  if (status === 419) {
    return "Security session expired. Refresh and try again.";
  }

  return (
    error.response.data?.message || "Something went wrong. Please try again."
  );
}

export default function PermissionsPage() {
  const { session, hasPermission, refreshUser } = useAuth();

  const isSuperAdmin = Boolean(session?.is_super_admin);

  const canCreate = hasPermission("permissions.create");
  const canDelete = hasPermission("permissions.delete");

  // PERMISSIONS LIST
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // FILTERS
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [usageFilter, setUsageFilter] = useState("all");

  // CREATE FORM
  const [formOpen, setFormOpen] = useState(false);
  const [permissionName, setPermissionName] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // DELETE AND FEEDBACK
  const [deletingId, setDeletingId] = useState(null);
  const [notice, setNotice] = useState("");

  // 1. Load permissions from Laravel.
  useEffect(() => {
    const controller = new AbortController();

    async function fetchPermissions() {
      setLoading(true);
      setListError("");

      try {
        const response = await api.get("/api/permissions", {
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setPermissions(response.data.data);
        }
      } catch (error) {
        if (!controller.signal.aborted && !axios.isCancel(error)) {
          setPermissions([]);
          setListError(getErrorMessage(error));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchPermissions();

    return () => controller.abort();
  }, [reloadKey]);

  const refreshPermissions = () => {
    setReloadKey((previous) => previous + 1);
  };

  // 2. Open the Create form.
  const openCreate = () => {
    if (!canCreate) return;

    setPermissionName(isSuperAdmin ? "" : "custom.");

    setFormErrors({});
    setFormError("");
    setNotice("");
    setFormOpen(true);
  };

  // 3. Close the Create form.
  const closeForm = () => {
    setFormOpen(false);
    setPermissionName("");
    setFormErrors({});
    setFormError("");
  };

  // 4. Create a new permission.
  const handleCreate = async (event) => {
    event.preventDefault();

    if (!canCreate || saving) return;

    setSaving(true);
    setFormErrors({});
    setFormError("");
    setNotice("");

    const name = permissionName.trim().toLowerCase();

    try {
      await api.post("/api/permissions", {
        name,
      });

      closeForm();

      // Update list and current user's permission data.
      refreshPermissions();
      await refreshUser();

      setNotice("Permission created successfully.");
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

  // 5. Delete an unused custom permission.
  const handleDelete = async (permission) => {
    if (!canDelete || !permission.can_delete || deletingId !== null) {
      return;
    }

    const confirmed = window.confirm(
      `Permanently delete "${permission.name}"?\n\n` +
        "This action cannot be undone.",
    );

    if (!confirmed) return;

    setDeletingId(permission.id);
    setListError("");
    setNotice("");

    try {
      await api.delete(`/api/permissions/${permission.id}`);

      refreshPermissions();
      await refreshUser();

      setNotice("Permission deleted successfully.");
    } catch (error) {
      setListError(getErrorMessage(error));

      // Another administrator may have assigned it
      // after we loaded the table.
      refreshPermissions();
    } finally {
      setDeletingId(null);
    }
  };

  // 6. Calculate summary counts.
  const totalCount = permissions.length;

  const coreCount = permissions.filter(
    (permission) => permission.type === "core",
  ).length;

  const customCount = permissions.filter(
    (permission) => permission.type === "custom",
  ).length;

  // 7. Apply local search and filters.
  const filteredPermissions = permissions.filter((permission) => {
    const query = search.trim().toLowerCase();

    const matchesSearch = permission.name.toLowerCase().includes(query);

    const matchesType = typeFilter === "all" || permission.type === typeFilter;

    const isAssigned = permission.roles_count > 0 || permission.users_count > 0;

    const matchesUsage =
      usageFilter === "all" ||
      (usageFilter === "assigned" && isAssigned) ||
      (usageFilter === "unused" && !isAssigned);

    return matchesSearch && matchesType && matchesUsage;
  });

  return (
    <div className="pm-page">
      {/* PAGE HEADER */}
      <div className="pm-heading">
        <div>
          <h1>Permissions Management</h1>
          <p>
            Manage registered permissions for your role-based access system.
          </p>
        </div>

        <div className="pm-heading-actions">
          <button
            type="button"
            className="pm-btn"
            onClick={refreshPermissions}
            disabled={loading}
          >
            Refresh
          </button>

          {canCreate && (
            <button
              type="button"
              className="pm-btn pm-btn-primary"
              onClick={openCreate}
            >
              + Create Permission
            </button>
          )}
        </div>
      </div>

      {/* FEEDBACK */}
      {notice && (
        <div className="pm-alert pm-success" role="status">
          {notice}
        </div>
      )}

      {listError && (
        <div className="pm-alert pm-error" role="alert">
          {listError}
        </div>
      )}

      {/* SUMMARY CARDS */}
      <div className="pm-summary-grid">
        <div className="pm-summary-card">
          <p>Total Permissions</p>
          <h2>{totalCount}</h2>
        </div>

        <div className="pm-summary-card">
          <p>Core Permissions</p>
          <h2>{coreCount}</h2>
        </div>

        <div className="pm-summary-card">
          <p>Custom Permissions</p>
          <h2>{customCount}</h2>
        </div>
      </div>

      {/* CREATE PERMISSION FORM */}
      {formOpen && canCreate && (
        <section className="pm-card">
          <div className="pm-card-heading">
            <div>
              <h2>Create New Permission</h2>
              <p>Register a new permission in MySQL.</p>
            </div>

            <button
              type="button"
              className="pm-close"
              onClick={closeForm}
              disabled={saving}
              aria-label="Close form"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleCreate}>
            <div className="pm-field">
              <label htmlFor="pm-name">Permission Name</label>

              <input
                id="pm-name"
                type="text"
                value={permissionName}
                onChange={(event) => {
                  setPermissionName(event.target.value);
                  setFormErrors({});
                }}
                maxLength={100}
                placeholder={
                  isSuperAdmin
                    ? "e.g. reports.export"
                    : "e.g. custom.stock.audit"
                }
                aria-invalid={Boolean(formErrors.name)}
                required
              />

              {formErrors.name?.[0] && (
                <small className="pm-field-error">{formErrors.name[0]}</small>
              )}

              <small className="pm-help">
                Use lowercase letters, numbers, dots, underscores or hyphens.
                Start with a letter.
              </small>
            </div>

            <div className="pm-info">
              {isSuperAdmin ? (
                <p>
                  Super Admin can create core permissions (for example,
                  reports.export) and custom permissions (for example,
                  custom.reports.export).
                </p>
              ) : (
                <p>
                  Your account may create custom permissions only. The
                  permission name must begin with
                  <code> custom.</code>
                </p>
              )}
            </div>

            {formError && (
              <div className="pm-alert pm-error" role="alert">
                {formError}
              </div>
            )}

            <div className="pm-form-actions">
              <button
                type="button"
                className="pm-btn"
                disabled={saving}
                onClick={closeForm}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="pm-btn pm-btn-primary"
                disabled={saving}
              >
                {saving ? "Creating..." : "Create Permission"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* PERMISSIONS TABLE */}
      <section className="pm-card">
        <div className="pm-card-heading">
          <div>
            <h2>Registered Permissions</h2>
            <p>
              {filteredPermissions.length} of {totalCount} permissions displayed
            </p>
          </div>
        </div>

        {/* FILTERS */}
        <div className="pm-filters">
          <div className="pm-field">
            <label htmlFor="pm-search">Search Permissions</label>

            <input
              id="pm-search"
              type="search"
              placeholder="e.g. items.view"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="pm-field">
            <label htmlFor="pm-type-filter">Permission Type</label>

            <select
              id="pm-type-filter"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="all">All Types</option>
              <option value="core">Core</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div className="pm-field">
            <label htmlFor="pm-usage-filter">Assignment Status</label>

            <select
              id="pm-usage-filter"
              value={usageFilter}
              onChange={(event) => setUsageFilter(event.target.value)}
            >
              <option value="all">All</option>
              <option value="assigned">Assigned</option>
              <option value="unused">Unassigned</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="pm-empty">Loading permissions...</div>
        ) : listError && permissions.length === 0 ? (
          <div className="pm-empty">Unable to load permissions.</div>
        ) : filteredPermissions.length === 0 ? (
          <div className="pm-empty">No matching permissions found.</div>
        ) : (
          <div className="pm-table-wrapper">
            <table className="pm-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Permission</th>
                  <th>Type</th>
                  <th>Role Assignments</th>
                  <th>Direct User Assignments</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredPermissions.map((permission) => {
                  const isCustom = permission.type === "custom";

                  const isAssigned =
                    permission.roles_count > 0 || permission.users_count > 0;

                  return (
                    <tr key={permission.id}>
                      <td>{permission.id}</td>

                      <td>
                        <code className="pm-code">{permission.name}</code>
                      </td>

                      <td>
                        <span
                          className={
                            isCustom
                              ? "pm-type pm-type-custom"
                              : "pm-type pm-type-core"
                          }
                        >
                          {isCustom ? "Custom" : "Core"}
                        </span>
                      </td>

                      <td>{permission.roles_count}</td>

                      <td>{permission.users_count}</td>

                      <td>
                        {!isCustom ? (
                          <span className="pm-protected">Protected</span>
                        ) : canDelete ? (
                          <div className="pm-actions">
                            <button
                              type="button"
                              className="pm-btn pm-btn-small pm-btn-danger"
                              onClick={() => handleDelete(permission)}
                              disabled={
                                !permission.can_delete || deletingId !== null
                              }
                              title={
                                isAssigned
                                  ? "Remove all assignments first"
                                  : "Delete custom permission"
                              }
                            >
                              {deletingId === permission.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>

                            {isAssigned && (
                              <small className="pm-help">In use</small>
                            )}
                          </div>
                        ) : (
                          <span className="pm-protected">View only</span>
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
