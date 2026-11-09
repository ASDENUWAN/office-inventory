import { useEffect, useState } from "react";
import axios from "axios";

import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

import "../styles/category-types.css";

// Category types required by our inventory system.
const SYSTEM_CODES = ["ITEM_CATEGORY", "ITEM_CONDITION"];

const emptyForm = {
  name: "",
  code: "",
  description: "",
  is_active: true,
};

// Convert API errors into readable messages.
function getErrorMessage(error) {
  const status = error.response?.status;

  if (!error.response) {
    return "Cannot connect to Laravel. Check the backend server.";
  }

  if (status === 401) {
    return "Your session has expired. Please log in again.";
  }

  if (status === 403) {
    return "You do not have permission to perform this action.";
  }

  if (status === 419) {
    return "Your security session expired. Refresh and try again.";
  }

  return (
    error.response?.data?.message || "Something went wrong. Please try again."
  );
}

export default function CategoryTypesPage() {
  const { hasPermission } = useAuth();

  const canManage = hasPermission("category-types.manage");

  const [categoryTypes, setCategoryTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });

  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [formMessage, setFormMessage] = useState("");

  const [notice, setNotice] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  // STEP 1: Load category types when the page opens.
  useEffect(() => {
    const controller = new AbortController();

    api
      .get("/api/category-types", {
        signal: controller.signal,
      })
      .then((response) => {
        if (!controller.signal.aborted) {
          setCategoryTypes(response.data.data);
          setLoadError("");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted && !axios.isCancel(error)) {
          setLoadError(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  // Reload the table manually.
  const refreshList = async () => {
    setLoading(true);
    setLoadError("");

    try {
      const response = await api.get("/api/category-types");
      setCategoryTypes(response.data.data);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Open an empty form to create a category type.
  const openCreateForm = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setFormErrors({});
    setFormMessage("");
    setNotice("");
    setFormOpen(true);
  };

  // STEP 3: Open the form with an existing record.
  const openEditForm = (categoryType) => {
    setEditingId(categoryType.id);

    setForm({
      name: categoryType.name,
      code: categoryType.code,
      description: categoryType.description ?? "",
      is_active: Boolean(categoryType.is_active),
    });

    setFormErrors({});
    setFormMessage("");
    setNotice("");
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setFormErrors({});
    setFormMessage("");
  };

  // STEP 4: Handle input changes.
  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));

    // Clear the field's previous validation error.
    setFormErrors((previous) => ({
      ...previous,
      [name]: undefined,
    }));
  };

  // STEP 5: Create or update through Laravel.
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canManage || saving) return;

    setSaving(true);
    setFormErrors({});
    setFormMessage("");
    setNotice("");

    const isEditing = editingId !== null;

    const isSystemType = isEditing && SYSTEM_CODES.includes(form.code);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
    };

    // System category types must remain active.
    if (!isSystemType) {
      payload.is_active = form.is_active;
    }

    // Codes can only be supplied during creation.
    if (!isEditing) {
      payload.code = form.code.trim().toUpperCase();
    }

    try {
      let response;

      if (isEditing) {
        response = await api.patch(`/api/category-types/${editingId}`, payload);
      } else {
        response = await api.post("/api/category-types", payload);
      }

      const savedType = response.data.data;

      // Update the table with data returned by Laravel.
      setCategoryTypes((previous) => {
        if (isEditing) {
          return previous.map((item) =>
            item.id === savedType.id ? savedType : item,
          );
        }

        return [...previous, savedType].sort((a, b) => a.id - b.id);
      });

      closeForm();

      setNotice(
        isEditing
          ? "Category type updated successfully."
          : "Category type created successfully.",
      );
    } catch (error) {
      if (error.response?.status === 422 && error.response?.data?.errors) {
        setFormErrors(error.response.data.errors);
      } else {
        setFormMessage(getErrorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  };

  // STEP 6: Delete a category type.
  const handleDelete = async (categoryType) => {
    if (!canManage) return;

    // Protect required category types.
    if (SYSTEM_CODES.includes(categoryType.code)) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${categoryType.name}"?\n\n` + "This action cannot be undone.",
    );

    if (!confirmed) return;

    setDeletingId(categoryType.id);
    setNotice("");
    setLoadError("");

    try {
      await api.delete(`/api/category-types/${categoryType.id}`);

      setCategoryTypes((previous) =>
        previous.filter((item) => item.id !== categoryType.id),
      );

      setNotice("Category type deleted successfully.");
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  const isEditing = editingId !== null;

  const isEditingSystemType = isEditing && SYSTEM_CODES.includes(form.code);

  return (
    <div className="ct-page">
      {/* PAGE HEADER */}
      <div className="ct-heading">
        <div>
          <h1>Category Types</h1>
          <p>Create and manage category groups used in the inventory system.</p>
        </div>

        <div className="ct-heading-actions">
          <button
            type="button"
            className="ct-btn ct-btn-secondary"
            onClick={refreshList}
            disabled={loading}
          >
            Refresh
          </button>

          {canManage && (
            <button
              type="button"
              className="ct-btn ct-btn-primary"
              onClick={openCreateForm}
            >
              + Add Category Type
            </button>
          )}
        </div>
      </div>

      {/* SUCCESS MESSAGE */}
      {notice && (
        <div className="ct-alert ct-alert-success" role="status">
          {notice}
        </div>
      )}

      {/* API ERROR */}
      {loadError && (
        <div className="ct-alert ct-alert-error" role="alert">
          {loadError}
        </div>
      )}

      {/* CREATE / EDIT FORM */}
      {formOpen && (
        <section className="ct-card ct-form-card">
          <div className="ct-card-heading">
            <h2>{isEditing ? "Edit Category Type" : "Add Category Type"}</h2>

            <button
              type="button"
              className="ct-close"
              onClick={closeForm}
              disabled={saving}
              aria-label="Close form"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="ct-form-grid">
              {/* NAME */}
              <div className="ct-field">
                <label htmlFor="ct-name">Category Type Name</label>

                <input
                  id="ct-name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Warranty Status"
                  maxLength={100}
                  aria-invalid={Boolean(formErrors.name)}
                  required
                />

                {formErrors.name?.[0] && (
                  <small className="ct-field-error">{formErrors.name[0]}</small>
                )}
              </div>

              {/* CODE */}
              <div className="ct-field">
                <label htmlFor="ct-code">Category Type Code</label>

                <input
                  id="ct-code"
                  name="code"
                  type="text"
                  value={form.code}
                  onChange={handleChange}
                  placeholder="e.g. WARRANTY_STATUS"
                  maxLength={100}
                  disabled={isEditing}
                  aria-invalid={Boolean(formErrors.code)}
                  required={!isEditing}
                />

                {formErrors.code?.[0] && (
                  <small className="ct-field-error">{formErrors.code[0]}</small>
                )}

                <small className="ct-field-help">
                  {isEditing
                    ? "Code cannot be changed after creation."
                    : "Use letters, numbers and underscores. Start with a letter."}
                </small>
              </div>

              {/* DESCRIPTION */}
              <div className="ct-field ct-full-width">
                <label htmlFor="ct-description">Description (optional)</label>

                <textarea
                  id="ct-description"
                  name="description"
                  rows={3}
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Enter a short description"
                />

                {formErrors.description?.[0] && (
                  <small className="ct-field-error">
                    {formErrors.description[0]}
                  </small>
                )}
              </div>
            </div>

            {/* ACTIVE STATUS */}
            {isEditingSystemType ? (
              <p className="ct-field-help">
                This is a required system category type. It cannot be
                deactivated.
              </p>
            ) : (
              <label className="ct-checkbox-label">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={form.is_active}
                  onChange={handleChange}
                />
                Active
              </label>
            )}

            {formErrors.is_active?.[0] && (
              <small className="ct-field-error">
                {formErrors.is_active[0]}
              </small>
            )}

            {formMessage && (
              <div className="ct-alert ct-alert-error" role="alert">
                {formMessage}
              </div>
            )}

            <div className="ct-form-actions">
              <button
                type="button"
                className="ct-btn ct-btn-secondary"
                onClick={closeForm}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="ct-btn ct-btn-primary"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : isEditing
                    ? "Update Category Type"
                    : "Save Category Type"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* CATEGORY TYPES TABLE */}
      <section className="ct-card">
        <div className="ct-card-heading">
          <div>
            <h2>All Category Types</h2>
            <p>{categoryTypes.length} records loaded</p>
          </div>
        </div>

        {loading ? (
          <div className="ct-empty">Loading category types...</div>
        ) : loadError && categoryTypes.length === 0 ? (
          <div className="ct-empty">Unable to load category types.</div>
        ) : categoryTypes.length === 0 ? (
          <div className="ct-empty">No category types found.</div>
        ) : (
          <div className="ct-table-wrapper">
            <table className="ct-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {categoryTypes.map((categoryType) => {
                  const isSystem = SYSTEM_CODES.includes(categoryType.code);

                  return (
                    <tr key={categoryType.id}>
                      <td>{categoryType.id}</td>

                      <td>
                        <strong>{categoryType.name}</strong>

                        {categoryType.description && (
                          <p className="ct-description">
                            {categoryType.description}
                          </p>
                        )}
                      </td>

                      <td>
                        <code className="ct-code">{categoryType.code}</code>
                      </td>

                      <td>
                        <span
                          className={
                            categoryType.is_active
                              ? "ct-status ct-active"
                              : "ct-status ct-inactive"
                          }
                        >
                          {categoryType.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td>
                        {canManage && (
                          <div className="ct-row-actions">
                            <button
                              type="button"
                              className="ct-btn ct-btn-small"
                              onClick={() => openEditForm(categoryType)}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="ct-btn ct-btn-small ct-btn-danger"
                              onClick={() => handleDelete(categoryType)}
                              disabled={
                                isSystem || deletingId === categoryType.id
                              }
                              title={
                                isSystem
                                  ? "Required system category type"
                                  : "Delete category type"
                              }
                            >
                              {deletingId === categoryType.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
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
