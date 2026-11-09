import { useEffect, useState } from "react";
import axios from "axios";

import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

import "../styles/categories.css";

const emptyForm = {
  category_type_id: "",
  name: "",
  description: "",
  is_active: true,
};

// Convert Laravel API errors into readable messages.
function getErrorMessage(error) {
  if (!error.response) {
    return "Cannot connect to Laravel. Check the backend server.";
  }

  const status = error.response.status;

  if (status === 401) {
    return "Your session has expired. Please log in again.";
  }

  if (status === 403) {
    return "You do not have permission for this action.";
  }

  if (status === 409) {
    return (
      error.response.data?.message ||
      "This category is being used and cannot be deleted."
    );
  }

  if (status === 419) {
    return "Security session expired. Refresh and try again.";
  }

  return (
    error.response.data?.message || "Something went wrong. Please try again."
  );
}

export default function CategoriesPage() {
  const { hasPermission } = useAuth();

  const canCreate = hasPermission("categories.create");
  const canUpdate = hasPermission("categories.update");
  const canDelete = hasPermission("categories.delete");

  // CATEGORY TYPE OPTIONS
  const [categoryTypes, setCategoryTypes] = useState([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [typesError, setTypesError] = useState("");

  // CATEGORY LIST
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  // FILTERS
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reloadKey, setReloadKey] = useState(0);

  // CREATE / EDIT FORM
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  const [form, setForm] = useState({ ...emptyForm });
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // DELETE
  const [deletingId, setDeletingId] = useState(null);

  // SUCCESS MESSAGE
  const [notice, setNotice] = useState("");

  // 1. Load active category types once.
  useEffect(() => {
    const controller = new AbortController();

    async function fetchCategoryTypes() {
      setTypesLoading(true);

      try {
        const response = await api.get("/api/category-types/options", {
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setCategoryTypes(response.data.data);
          setTypesError("");
        }
      } catch (error) {
        if (!controller.signal.aborted && !axios.isCancel(error)) {
          setTypesError(getErrorMessage(error));
        }
      } finally {
        if (!controller.signal.aborted) {
          setTypesLoading(false);
        }
      }
    }

    fetchCategoryTypes();

    return () => controller.abort();
  }, []);

  // 2. Load categories whenever filters change.
  useEffect(() => {
    const controller = new AbortController();

    async function fetchCategories() {
      setLoading(true);
      setListError("");

      try {
        const params = {};

        if (typeFilter) {
          params.type = typeFilter;
        }

        if (statusFilter === "active") {
          params.active_only = 1;
        }

        const response = await api.get("/api/categories", {
          params,
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          let records = response.data.data;

          // The backend supports active_only.
          // For inactive-only, filter the returned records.
          if (statusFilter === "inactive") {
            records = records.filter((category) => !category.is_active);
          }

          setCategories(records);
        }
      } catch (error) {
        if (!controller.signal.aborted && !axios.isCancel(error)) {
          setCategories([]);
          setListError(getErrorMessage(error));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchCategories();

    // Cancel previous requests when filters change.
    return () => controller.abort();
  }, [typeFilter, statusFilter, reloadKey]);

  // Reload categories after successful operations.
  const refreshCategories = () => {
    setReloadKey((previous) => previous + 1);
  };

  // 3. Open the Create form.
  const openCreate = () => {
    if (!canCreate) return;

    setEditingCategory(null);
    setForm({ ...emptyForm });
    setFormErrors({});
    setFormError("");
    setNotice("");
    setFormOpen(true);
  };

  // 4. Open the Edit form.
  const openEdit = (category) => {
    if (!canUpdate) return;

    setEditingCategory(category);

    setForm({
      category_type_id: String(category.category_type_id),
      name: category.name,
      description: category.description ?? "",
      is_active: Boolean(category.is_active),
    });

    setFormErrors({});
    setFormError("");
    setNotice("");
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingCategory(null);
    setForm({ ...emptyForm });
    setFormErrors({});
    setFormError("");
  };

  // 5. Update form fields.
  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));

    setFormErrors((previous) => ({
      ...previous,
      [name]: undefined,
    }));
  };

  // 6. Create or update a category.
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) return;

    const isEditing = editingCategory !== null;

    if (isEditing && !canUpdate) return;
    if (!isEditing && !canCreate) return;

    setSaving(true);
    setFormErrors({});
    setFormError("");
    setNotice("");

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      is_active: form.is_active,
    };

    // category_type_id is allowed on creation only.
    if (!isEditing) {
      payload.category_type_id = Number(form.category_type_id);
    }

    try {
      if (isEditing) {
        await api.patch(`/api/categories/${editingCategory.id}`, payload);
      } else {
        await api.post("/api/categories", payload);
      }

      closeForm();
      refreshCategories();

      setNotice(
        isEditing
          ? "Category updated successfully."
          : "Category created successfully.",
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

  // 7. Delete a category.
  const handleDelete = async (category) => {
    if (!canDelete || deletingId !== null) return;

    const confirmed = window.confirm(
      `Delete "${category.name}"?\n\n` +
        "Categories used by items cannot be deleted.",
    );

    if (!confirmed) return;

    setDeletingId(category.id);
    setNotice("");
    setListError("");

    try {
      await api.delete(`/api/categories/${category.id}`);

      refreshCategories();
      setNotice("Category deleted successfully.");
    } catch (error) {
      setListError(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  const isEditing = editingCategory !== null;

  // Active types are available for creating new categories.
  const selectedType = categoryTypes.find(
    (type) => String(type.id) === form.category_type_id,
  );

  return (
    <div className="cat-page">
      {/* PAGE HEADER */}
      <div className="cat-page-header">
        <div>
          <h1>Categories</h1>
          <p>Manage category values used by inventory forms.</p>
        </div>

        <div className="cat-header-actions">
          <button
            type="button"
            className="cat-btn cat-btn-outline"
            onClick={refreshCategories}
            disabled={loading}
          >
            Refresh
          </button>

          {canCreate && (
            <button
              type="button"
              className="cat-btn cat-btn-primary"
              onClick={openCreate}
              disabled={typesLoading || categoryTypes.length === 0}
            >
              + Add Category
            </button>
          )}
        </div>
      </div>

      {/* NOTIFICATIONS */}
      {notice && (
        <div className="cat-alert cat-alert-success" role="status">
          {notice}
        </div>
      )}

      {listError && (
        <div className="cat-alert cat-alert-error" role="alert">
          {listError}
        </div>
      )}

      {typesError && (
        <div className="cat-alert cat-alert-error" role="alert">
          {typesError}
        </div>
      )}

      {/* CREATE / EDIT FORM */}
      {formOpen && (
        <section className="cat-card">
          <div className="cat-card-header">
            <h2>{isEditing ? "Edit Category" : "Add Category"}</h2>

            <button
              type="button"
              className="cat-close"
              onClick={closeForm}
              disabled={saving}
              aria-label="Close form"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="cat-form-grid">
              {/* CATEGORY TYPE */}
              <div className="cat-field">
                <label htmlFor="category-type">Category Type</label>

                {isEditing ? (
                  <>
                    <input
                      id="category-type"
                      type="text"
                      value={
                        editingCategory.category_type?.name ||
                        "Unknown Category Type"
                      }
                      disabled
                    />

                    <small className="cat-help">
                      Category type cannot be changed after creation.
                    </small>
                  </>
                ) : (
                  <>
                    <select
                      id="category-type"
                      name="category_type_id"
                      value={form.category_type_id}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select Category Type</option>

                      {categoryTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>

                    {selectedType && (
                      <small className="cat-help">
                        Code: {selectedType.code}
                      </small>
                    )}
                  </>
                )}

                {formErrors.category_type_id?.[0] && (
                  <small className="cat-field-error">
                    {formErrors.category_type_id[0]}
                  </small>
                )}
              </div>

              {/* CATEGORY NAME */}
              <div className="cat-field">
                <label htmlFor="category-name">Category Name</label>

                <input
                  id="category-name"
                  name="name"
                  type="text"
                  placeholder="e.g. Monitor"
                  value={form.name}
                  onChange={handleChange}
                  maxLength={100}
                  required
                />

                {formErrors.name?.[0] && (
                  <small className="cat-field-error">
                    {formErrors.name[0]}
                  </small>
                )}
              </div>

              {/* DESCRIPTION */}
              <div className="cat-field cat-full-width">
                <label htmlFor="category-description">
                  Description (optional)
                </label>

                <textarea
                  id="category-description"
                  name="description"
                  rows={3}
                  placeholder="Describe this category"
                  value={form.description}
                  onChange={handleChange}
                />

                {formErrors.description?.[0] && (
                  <small className="cat-field-error">
                    {formErrors.description[0]}
                  </small>
                )}
              </div>
            </div>

            {/* ACTIVE STATUS */}
            <label className="cat-checkbox-label">
              <input
                type="checkbox"
                name="is_active"
                checked={form.is_active}
                onChange={handleChange}
              />
              Active Category
            </label>

            {formErrors.is_active?.[0] && (
              <small className="cat-field-error">
                {formErrors.is_active[0]}
              </small>
            )}

            {formError && (
              <div className="cat-alert cat-alert-error" role="alert">
                {formError}
              </div>
            )}

            <div className="cat-form-actions">
              <button
                type="button"
                className="cat-btn cat-btn-outline"
                onClick={closeForm}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="cat-btn cat-btn-primary"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : isEditing
                    ? "Update Category"
                    : "Save Category"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* CATEGORY TABLE */}
      <section className="cat-card">
        <div className="cat-card-header">
          <div>
            <h2>All Categories</h2>
            <p>Manage category values and their status</p>
          </div>
        </div>

        {/* FILTERS */}
        <div className="cat-filters">
          <div className="cat-field">
            <label htmlFor="filter-type">Filter by Category Type</label>

            <select
              id="filter-type"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="">All Category Types</option>

              {categoryTypes.map((type) => (
                <option key={type.id} value={type.code}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          <div className="cat-field">
            <label htmlFor="filter-status">Filter by Status</label>

            <select
              id="filter-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* LOADING AND EMPTY STATES */}
        {loading ? (
          <div className="cat-empty">Loading categories...</div>
        ) : listError ? (
          <div className="cat-empty">Unable to load categories.</div>
        ) : categories.length === 0 ? (
          <div className="cat-empty">
            No categories found for the selected filters.
          </div>
        ) : (
          <div className="cat-table-wrapper">
            <table className="cat-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Category</th>
                  <th>Category Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td>{category.id}</td>

                    <td>
                      <strong>{category.name}</strong>

                      {category.description && (
                        <p className="cat-description">
                          {category.description}
                        </p>
                      )}
                    </td>

                    <td>
                      <span className="cat-type-label">
                        {category.category_type?.name || "Unknown"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={
                          category.is_active
                            ? "cat-status cat-active"
                            : "cat-status cat-inactive"
                        }
                      >
                        {category.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td>
                      <div className="cat-row-actions">
                        {canUpdate && (
                          <button
                            type="button"
                            className="cat-btn cat-btn-small"
                            onClick={() => openEdit(category)}
                          >
                            Edit
                          </button>
                        )}

                        {canDelete && (
                          <button
                            type="button"
                            className="cat-btn cat-btn-small cat-btn-danger"
                            onClick={() => handleDelete(category)}
                            disabled={deletingId !== null}
                          >
                            {deletingId === category.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        )}

                        {!canUpdate && !canDelete && (
                          <span className="cat-help">View only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
