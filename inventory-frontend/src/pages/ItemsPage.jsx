import { useEffect, useState } from "react";
import axios from "axios";

import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

import "../styles/items.css";

const emptyForm = {
  name: "",
  category_id: "",
  condition_category_id: "",
  quantity: "0",
  description: "",
};

const emptyMeta = {
  current_page: 1,
  last_page: 1,
  per_page: 10,
  total: 0,
};

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

  if (status === 404) {
    return "This item could not be found. Refresh the list.";
  }

  if (status === 419) {
    return "Security session expired. Refresh and try again.";
  }

  if (status === 409) {
    return (
      error.response.data?.message ||
      "The operation conflicts with existing data."
    );
  }

  return (
    error.response.data?.message || "Something went wrong. Please try again."
  );
}

// Preserve a historical inactive category when editing.
// The backend allows keeping it if it isn't changed.
function withCurrentOption(options, id, name) {
  if (!id || options.some((option) => String(option.id) === String(id))) {
    return options;
  }

  return [
    {
      id,
      name: `${name || "Previously selected"} (current)`,
    },
    ...options,
  ];
}

export default function ItemsPage() {
  const { hasPermission } = useAuth();

  const canCreate = hasPermission("items.create");
  const canUpdate = hasPermission("items.update");
  const canDelete = hasPermission("items.delete");
  const canAdjust = hasPermission("items.adjust-quantity");

  // INVENTORY LIST
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(emptyMeta);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // DROPDOWN OPTIONS
  const [options, setOptions] = useState({
    item_categories: [],
    conditions: [],
  });
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState("");

  // CREATE / EDIT FORM
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // QUANTITY FORM
  const [quantityItem, setQuantityItem] = useState(null);
  const [quantityInput, setQuantityInput] = useState("0");
  const [quantityError, setQuantityError] = useState("");
  const [quantitySaving, setQuantitySaving] = useState(false);

  // DELETE AND FEEDBACK
  const [deletingId, setDeletingId] = useState(null);
  const [notice, setNotice] = useState("");

  // 1. Load paginated items.
  useEffect(() => {
    const controller = new AbortController();

    async function fetchItems() {
      setLoading(true);
      setListError("");

      try {
        const response = await api.get("/api/items", {
          params: { page },
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setItems(response.data.data);
          setMeta(response.data.meta);
        }
      } catch (error) {
        if (!controller.signal.aborted && !axios.isCancel(error)) {
          setItems([]);
          setListError(getErrorMessage(error));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchItems();

    return () => controller.abort();
  }, [page, reloadKey]);

  // 2. Load active categories and conditions.
  useEffect(() => {
    const controller = new AbortController();

    async function fetchOptions() {
      setOptionsLoading(true);
      setOptionsError("");

      try {
        const response = await api.get("/api/items/form-options", {
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setOptions(response.data.data);
        }
      } catch (error) {
        if (!controller.signal.aborted && !axios.isCancel(error)) {
          setOptionsError(getErrorMessage(error));
        }
      } finally {
        if (!controller.signal.aborted) {
          setOptionsLoading(false);
        }
      }
    }

    fetchOptions();

    return () => controller.abort();
  }, []);

  const refreshItems = () => {
    setReloadKey((previous) => previous + 1);
  };

  const canCreateWithOptions =
    !optionsLoading &&
    options.item_categories.length > 0 &&
    options.conditions.length > 0;

  // 3. Open the Create form.
  const openCreate = () => {
    if (!canCreate || !canCreateWithOptions) return;

    setQuantityItem(null);
    setEditingItem(null);
    setForm({ ...emptyForm });
    setFormErrors({});
    setFormError("");
    setNotice("");
    setFormOpen(true);
  };

  // 4. Open the Edit form.
  const openEdit = (item) => {
    if (!canUpdate) return;

    setQuantityItem(null);
    setEditingItem(item);

    setForm({
      name: item.name,
      category_id: String(item.category_id),
      condition_category_id: String(item.condition_category_id),
      quantity: String(item.quantity),
      description: item.description ?? "",
    });

    setFormErrors({});
    setFormError("");
    setNotice("");
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingItem(null);
    setForm({ ...emptyForm });
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

  // 5. Submit Create or Edit form.
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) return;

    const isEditing = editingItem !== null;

    if (isEditing && !canUpdate) return;
    if (!isEditing && !canCreate) return;

    setSaving(true);
    setFormErrors({});
    setFormError("");
    setNotice("");

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
    };

    if (isEditing) {
      // Send category IDs only if they have changed.
      // This allows existing inactive categories to remain.
      if (Number(form.category_id) !== editingItem.category_id) {
        payload.category_id = Number(form.category_id);
      }

      if (
        Number(form.condition_category_id) !== editingItem.condition_category_id
      ) {
        payload.condition_category_id = Number(form.condition_category_id);
      }

      // Quantity, created_by and updated_by are
      // intentionally NOT included in normal updates.
    } else {
      payload.category_id = Number(form.category_id);
      payload.condition_category_id = Number(form.condition_category_id);

      // Only authorized users can set starting stock.
      if (canAdjust) {
        payload.quantity = Number(form.quantity);
      }
    }

    try {
      if (isEditing) {
        await api.patch(`/api/items/${editingItem.id}`, payload);
      } else {
        await api.post("/api/items", payload);
      }

      closeForm();

      // New items appear at the top (latest ID first).
      if (!isEditing && page !== 1) {
        setPage(1);
      } else {
        refreshItems();
      }

      setNotice(
        isEditing ? "Item updated successfully." : "Item created successfully.",
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

  // 6. Open dedicated quantity form.
  const openQuantityForm = (item) => {
    if (!canAdjust) return;

    setFormOpen(false);
    setQuantityItem(item);
    setQuantityInput(String(item.quantity));
    setQuantityError("");
    setNotice("");
  };

  // 7. Set the new quantity using separate API.
  const handleQuantitySubmit = async (event) => {
    event.preventDefault();

    if (!canAdjust || !quantityItem || quantitySaving) return;

    const quantity = Number(quantityInput);

    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 0 ||
      quantity > 4294967295
    ) {
      setQuantityError("Enter a valid nonnegative whole number.");
      return;
    }

    setQuantitySaving(true);
    setQuantityError("");
    setNotice("");

    try {
      await api.patch(`/api/items/${quantityItem.id}/quantity`, { quantity });

      setQuantityItem(null);
      refreshItems();
      setNotice("Item quantity updated successfully.");
    } catch (error) {
      setQuantityError(getErrorMessage(error));
    } finally {
      setQuantitySaving(false);
    }
  };

  // 8. Delete an item.
  const handleDelete = async (item) => {
    if (!canDelete || deletingId !== null) return;

    const confirmed = window.confirm(
      `Permanently delete "${item.name}"?\n\n` +
        "This action cannot be undone.",
    );

    if (!confirmed) return;

    setDeletingId(item.id);
    setNotice("");
    setListError("");

    try {
      await api.delete(`/api/items/${item.id}`);

      if (items.length === 1 && page > 1) {
        setPage((previous) => previous - 1);
      } else {
        refreshItems();
      }

      setNotice("Item deleted successfully.");
    } catch (error) {
      setListError(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  const isEditing = editingItem !== null;

  const itemCategoryOptions = isEditing
    ? withCurrentOption(
        options.item_categories,
        editingItem.category_id,
        editingItem.category?.name,
      )
    : options.item_categories;

  const conditionOptions = isEditing
    ? withCurrentOption(
        options.conditions,
        editingItem.condition_category_id,
        editingItem.condition?.name,
      )
    : options.conditions;

  return (
    <div className="it-page">
      {/* PAGE HEADER */}
      <div className="it-heading">
        <div>
          <h1>Inventory Items</h1>
          <p>Manage equipment, stock, and item accountability.</p>
        </div>

        <div className="it-heading-actions">
          <button
            type="button"
            className="it-btn"
            onClick={refreshItems}
            disabled={loading}
          >
            Refresh
          </button>

          {canCreate && (
            <button
              type="button"
              className="it-btn it-btn-primary"
              onClick={openCreate}
              disabled={!canCreateWithOptions}
            >
              + Add Item
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="it-alert it-success" role="status">
          {notice}
        </div>
      )}

      {listError && (
        <div className="it-alert it-error" role="alert">
          {listError}
        </div>
      )}

      {optionsError && (
        <div className="it-alert it-error" role="alert">
          Cannot load dropdown options: {optionsError}
        </div>
      )}

      {canCreate &&
        !optionsLoading &&
        !optionsError &&
        !canCreateWithOptions && (
          <div className="it-alert it-warning">
            Create active Item Category and Item Condition values in Categories
            before adding an item.
          </div>
        )}

      {/* CREATE / EDIT FORM */}
      {formOpen && (
        <section className="it-card">
          <div className="it-card-heading">
            <h2>{isEditing ? "Edit Item" : "Add Item"}</h2>

            <button
              type="button"
              className="it-close"
              onClick={closeForm}
              disabled={saving}
              aria-label="Close form"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="it-form-grid">
              <div className="it-field it-full">
                <label htmlFor="it-name">Item Name</label>

                <input
                  id="it-name"
                  name="name"
                  type="text"
                  placeholder="e.g. Dell Latitude 5420"
                  value={form.name}
                  onChange={handleChange}
                  maxLength={150}
                  required
                />

                {formErrors.name?.[0] && (
                  <small className="it-field-error">{formErrors.name[0]}</small>
                )}
              </div>

              <div className="it-field">
                <label htmlFor="it-category">Item Category</label>

                <select
                  id="it-category"
                  name="category_id"
                  value={form.category_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select category</option>

                  {itemCategoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>

                {formErrors.category_id?.[0] && (
                  <small className="it-field-error">
                    {formErrors.category_id[0]}
                  </small>
                )}
              </div>

              <div className="it-field">
                <label htmlFor="it-condition">Item Condition</label>

                <select
                  id="it-condition"
                  name="condition_category_id"
                  value={form.condition_category_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select condition</option>

                  {conditionOptions.map((condition) => (
                    <option key={condition.id} value={condition.id}>
                      {condition.name}
                    </option>
                  ))}
                </select>

                {formErrors.condition_category_id?.[0] && (
                  <small className="it-field-error">
                    {formErrors.condition_category_id[0]}
                  </small>
                )}
              </div>

              {!isEditing && (
                <div className="it-field">
                  {canAdjust ? (
                    <>
                      <label htmlFor="it-quantity">Initial Quantity</label>

                      <input
                        id="it-quantity"
                        name="quantity"
                        type="number"
                        min="0"
                        max="4294967295"
                        step="1"
                        value={form.quantity}
                        onChange={handleChange}
                        required
                      />

                      {formErrors.quantity?.[0] && (
                        <small className="it-field-error">
                          {formErrors.quantity[0]}
                        </small>
                      )}
                    </>
                  ) : (
                    <p className="it-help">
                      Starting quantity will be 0. Stock adjustments require a
                      separate permission.
                    </p>
                  )}
                </div>
              )}

              <div className="it-field it-full">
                <label htmlFor="it-description">Description (optional)</label>

                <textarea
                  id="it-description"
                  name="description"
                  rows={3}
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Describe the inventory item"
                />

                {formErrors.description?.[0] && (
                  <small className="it-field-error">
                    {formErrors.description[0]}
                  </small>
                )}
              </div>
            </div>

            {isEditing && (
              <p className="it-help">
                Item quantity is changed through the separate Adjust Quantity
                action. Created By remains unchanged.
              </p>
            )}

            {formError && (
              <div className="it-alert it-error" role="alert">
                {formError}
              </div>
            )}

            <div className="it-form-actions">
              <button
                type="button"
                className="it-btn"
                onClick={closeForm}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="it-btn it-btn-primary"
                disabled={saving}
              >
                {saving ? "Saving..." : isEditing ? "Update Item" : "Save Item"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* QUANTITY ADJUSTMENT FORM */}
      {quantityItem && canAdjust && (
        <section className="it-card">
          <div className="it-card-heading">
            <div>
              <h2>Adjust Quantity</h2>
              <p>{quantityItem.name}</p>
            </div>

            <button
              type="button"
              className="it-close"
              onClick={() => setQuantityItem(null)}
              disabled={quantitySaving}
              aria-label="Close quantity form"
            >
              ×
            </button>
          </div>

          <p className="it-help">Current quantity: {quantityItem.quantity}</p>

          <p className="it-help">
            Enter the new total quantity, not the amount to add or subtract.
          </p>

          <form onSubmit={handleQuantitySubmit}>
            <div className="it-field it-quantity-field">
              <label htmlFor="adjust-quantity">New Total Quantity</label>

              <input
                id="adjust-quantity"
                type="number"
                min="0"
                max="4294967295"
                step="1"
                required
                value={quantityInput}
                onChange={(event) => setQuantityInput(event.target.value)}
              />
            </div>

            {quantityError && (
              <div className="it-alert it-error" role="alert">
                {quantityError}
              </div>
            )}

            <div className="it-form-actions">
              <button
                type="button"
                className="it-btn"
                onClick={() => setQuantityItem(null)}
                disabled={quantitySaving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="it-btn it-btn-primary"
                disabled={quantitySaving}
              >
                {quantitySaving ? "Updating..." : "Update Quantity"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* INVENTORY TABLE */}
      <section className="it-card">
        <div className="it-card-heading">
          <div>
            <h2>All Inventory Items</h2>
            <p>{meta.total} items in the inventory</p>
          </div>
        </div>

        {loading ? (
          <div className="it-empty">Loading items...</div>
        ) : listError ? (
          <div className="it-empty">Unable to load inventory items.</div>
        ) : items.length === 0 ? (
          <div className="it-empty">No inventory items found.</div>
        ) : (
          <div className="it-table-wrapper">
            <table className="it-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Condition</th>
                  <th>Quantity</th>
                  <th>Created By</th>
                  <th>Last Updated By</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>

                      <small className="it-item-id">Item #{item.id}</small>

                      {item.description && (
                        <p className="it-description">{item.description}</p>
                      )}
                    </td>

                    <td>{item.category?.name || "Unknown"}</td>

                    <td>{item.condition?.name || "Unknown"}</td>

                    <td>
                      <span className="it-quantity">{item.quantity}</span>
                    </td>

                    <td>{item.creator?.name || "Not recorded"}</td>

                    <td>{item.updater?.name || "Not updated yet"}</td>

                    <td>
                      <div className="it-row-actions">
                        {canUpdate && (
                          <button
                            type="button"
                            className="it-btn it-btn-small"
                            onClick={() => openEdit(item)}
                          >
                            Edit
                          </button>
                        )}

                        {canAdjust && (
                          <button
                            type="button"
                            className="it-btn it-btn-small"
                            onClick={() => openQuantityForm(item)}
                          >
                            Quantity
                          </button>
                        )}

                        {canDelete && (
                          <button
                            type="button"
                            className="it-btn it-btn-small it-btn-danger"
                            onClick={() => handleDelete(item)}
                            disabled={deletingId !== null}
                          >
                            {deletingId === item.id ? "Deleting..." : "Delete"}
                          </button>
                        )}

                        {!canUpdate && !canAdjust && !canDelete && (
                          <span className="it-help">View only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION */}
        <div className="it-pagination">
          <span>
            Page {meta.current_page} of {meta.last_page}
            {" · "}
            {meta.total} records
          </span>

          <div className="it-pagination-actions">
            <button
              type="button"
              className="it-btn it-btn-small"
              disabled={loading || page <= 1}
              onClick={() => setPage((previous) => previous - 1)}
            >
              Previous
            </button>

            <button
              type="button"
              className="it-btn it-btn-small"
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
