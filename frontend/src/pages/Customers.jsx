import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import PageHeader from "../components/shared/PageHeader";
import DataTable from "../components/shared/DataTable";
import ConfirmModal from "../components/shared/ConfirmModal";
import PhoneInput from "../components/shared/PhoneInput";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";
import { INDIAN_STATES, deriveStateFromGstin, isIndianCountry } from "../utils/gst";

const SALUTATIONS = ["Mr.", "Mrs.", "Ms.", "M/s.", "Dr."];

const EMPTY_FORM = {
  salutation: "Mr.",
  name: "",
  mobile: "",
  email: "",
  gstin: "",
  country: "India",
  state_name: "",
  state_code: "",
  billing_address: "",
  shipping_address: "",
};

function mapCustomerToForm(row) {
  return {
    salutation: row.salutation || "Mr.",
    name: row.name || "",
    mobile: row.mobile || "",
    email: row.email || "",
    gstin: row.gstin || "",
    country: row.country || "India",
    state_name: row.state_name || "",
    state_code: row.state_code || "",
    billing_address: row.billing_address || row.address || "",
    shipping_address: row.shipping_address || row.billing_address || row.address || "",
  };
}

export default function Customers() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const canAddCustomers = hasPermission(user, "can_add_customers");
  const canEditCustomers = hasPermission(user, "can_edit_customers");
  const canDeleteCustomers = hasPermission(user, "can_delete_customers");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/customers?page=${page}&pageSize=${pageSize}&search=${search}`);
      setData(res.data.data);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch {
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(row) {
    setEditId(row.id);
    setForm(mapCustomerToForm(row));
    setShowModal(true);
  }

  function updateForm(patch) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function handleCountryChange(value) {
    if (isIndianCountry(value)) {
      updateForm({ country: "India" });
      return;
    }

    updateForm({
      country: value,
      state_name: "",
      state_code: "",
    });
  }

  function handleStateChange(stateCode) {
    const state = INDIAN_STATES.find((item) => item.code === stateCode);
    updateForm({
      state_code: state?.code || "",
      state_name: state?.name || "",
    });
  }

  function handleGstinChange(value) {
    const nextValue = value.toUpperCase();
    const state = deriveStateFromGstin(nextValue);
    updateForm({
      gstin: nextValue,
      ...(state && isIndianCountry(form.country)
        ? { state_code: state.code, state_name: state.name }
        : {}),
    });
  }

  async function handleSave(event) {
    event.preventDefault();

    if (!form.name || !form.mobile || !form.billing_address) {
      toast.error("Name, mobile, and billing address are required");
      return;
    }

    if (isIndianCountry(form.country) && !form.state_code) {
      toast.error("State is required for customers in India");
      return;
    }

    const payload = {
      salutation: form.salutation,
      name: form.name,
      mobile: form.mobile,
      email: form.email,
      gstin: form.gstin,
      country: form.country,
      state_name: form.state_name,
      state_code: form.state_code,
      address: form.billing_address,
      billing_address: form.billing_address,
      shipping_address: form.shipping_address || form.billing_address,
    };

    setSaving(true);
    try {
      if (editId) {
        await api.put(`/customers/${editId}`, payload);
        toast.success("Customer updated");
      } else {
        await api.post("/customers", payload);
        toast.success("Customer created");
      }
      setShowModal(false);
      fetchData();
    } catch (error) {
      let message = error.response?.data?.error || "Failed to save";
      if (error.response?.data?.details) {
        message = Object.values(error.response.data.details)
          .map((detail) => detail.msg)
          .join(", ");
      }
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/customers/${deleteId}`);
      toast.success("Customer deleted");
      setDeleteId(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  const columns = [
    {
      key: "code",
      label: "Code",
      style: { width: "88px" },
      render: (row) => <span className="fw-medium text-primary">{row.code}</span>,
    },
    {
      key: "name",
      label: "Party",
      render: (row) => (
        <>
          <div className="fw-medium">{row.salutation} {row.name}</div>
          <div className="small text-muted">
            {row.country || "India"}
            {row.state_name ? `, ${row.state_name}` : ""}
          </div>
          {row.email && <small className="text-muted">{row.email}</small>}
        </>
      ),
    },
    { key: "mobile", label: "Mobile", style: { width: "120px" } },
    {
      key: "balance",
      label: "Balance",
      style: { width: "130px" },
      render: (row) => {
        const balance = Number(row.balance || 0);
        if (balance === 0) return <span className="text-muted">₹0.00</span>;
        if (balance < 0) return <span className="text-danger fw-medium">Due: ₹{Math.abs(balance).toFixed(2)}</span>;
        return <span className="text-success fw-medium">Adv: ₹{balance.toFixed(2)}</span>;
      },
    },
    {
      key: "gstin",
      label: "GST / Type",
      style: { width: "190px" },
      render: (row) => (
        row.gstin ? (
          <>
            <div className="small fw-medium">{row.gstin}</div>
            <small className="text-success">B2B</small>
          </>
        ) : (
          <span className="text-muted">{isIndianCountry(row.country || "India") ? "B2C" : "Export"}</span>
        )
      ),
    },
    {
      key: "address",
      label: "Billing Address",
      render: (row) => (
        <small className="text-muted">
          {(row.billing_address || row.address || "").slice(0, 56)}
          {(row.billing_address || row.address || "").length > 56 ? "..." : ""}
        </small>
      ),
    },
  ];

  if (canEditCustomers || canDeleteCustomers) {
    columns.push({
      key: "actions",
      label: "",
      style: { width: "80px" },
      render: (row) => (
        <div className="d-flex gap-1 justify-content-end">
          {canEditCustomers && (
            <button
              className="btn btn-link btn-sm p-0 text-primary"
              onClick={(event) => {
                event.stopPropagation();
                openEdit(row);
              }}
            >
              <i className="fa-solid fa-pen-to-square" />
            </button>
          )}
          {canDeleteCustomers && (
            <button
              className="btn btn-link btn-sm p-0 text-danger"
              onClick={(event) => {
                event.stopPropagation();
                setDeleteId(row.id);
              }}
            >
              <i className="fa-solid fa-trash" />
            </button>
          )}
        </div>
      ),
    });
  }

  return (
    <div>
      <PageHeader title="Customers" icon="fa-solid fa-users" subtitle={`${total} customers`}>
        {canAddCustomers && (
          <button className="btn btn-primary btn-sm" onClick={openCreate} id="add-customer-btn">
            <i className="fa-solid fa-plus me-1" />
            Add Customer
          </button>
        )}
      </PageHeader>

      <DataTable
        columns={columns}
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        loading={loading}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search customers..."
        emptyMessage="No customers found"
        emptyIcon="fa-solid fa-user-group"
      />

      {showModal && (
        <>
          <div className="modal-backdrop fade show" onClick={() => setShowModal(false)} />
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content border-0 shadow">
                <div className="modal-header">
                  <h6 className="modal-title fw-semibold">
                    <i className="fa-solid fa-user me-2 text-primary" />
                    {editId ? "Edit" : "New"} Customer
                  </h6>
                  <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
                </div>

                <form onSubmit={handleSave}>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-4 col-md-2">
                        <label className="form-label small fw-medium">Salutation</label>
                        <select
                          className="form-select form-select-sm"
                          value={form.salutation}
                          onChange={(event) => updateForm({ salutation: event.target.value })}
                        >
                          {SALUTATIONS.map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-8 col-md-5">
                        <label className="form-label small fw-medium">Customer Name *</label>
                        <input
                          className="form-control form-control-sm"
                          value={form.name}
                          onChange={(event) => updateForm({ name: event.target.value })}
                          required
                        />
                      </div>
                      <div className="col-6 col-md-5">
                        <label className="form-label small fw-medium">Mobile *</label>
                        <PhoneInput
                          className="input-group-sm"
                          value={form.mobile}
                          onChange={(event) => updateForm({ mobile: event.target.value })}
                          required
                        />
                      </div>
                      <div className="col-6 col-md-4">
                        <label className="form-label small fw-medium">Email</label>
                        <input
                          type="email"
                          className="form-control form-control-sm"
                          value={form.email}
                          onChange={(event) => updateForm({ email: event.target.value })}
                        />
                      </div>
                      <div className="col-6 col-md-4">
                        <label className="form-label small fw-medium">Country</label>
                        <input
                          className="form-control form-control-sm"
                          value={form.country}
                          onChange={(event) => handleCountryChange(event.target.value)}
                        />
                      </div>
                      <div className="col-6 col-md-4">
                        <label className="form-label small fw-medium">GSTIN</label>
                        <input
                          className="form-control form-control-sm text-uppercase"
                          value={form.gstin}
                          onChange={(event) => handleGstinChange(event.target.value)}
                          placeholder="Optional"
                        />
                      </div>
                      <div className="col-6 col-md-8">
                        <label className="form-label small fw-medium">State {isIndianCountry(form.country) ? "*" : ""}</label>
                        <select
                          className="form-select form-select-sm"
                          value={form.state_code}
                          onChange={(event) => handleStateChange(event.target.value)}
                          disabled={!isIndianCountry(form.country)}
                        >
                          <option value="">Select state</option>
                          {INDIAN_STATES.filter((state) => Number(state.code) < 90).map((state) => (
                            <option key={state.code} value={state.code}>
                              {state.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-6 col-md-4">
                        <label className="form-label small fw-medium">State Code</label>
                        <input className="form-control form-control-sm" value={form.state_code} readOnly />
                      </div>
                      <div className="col-12">
                        <label className="form-label small fw-medium">Billing Address *</label>
                        <textarea
                          className="form-control form-control-sm"
                          rows={2}
                          value={form.billing_address}
                          onChange={(event) => updateForm({ billing_address: event.target.value })}
                          required
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label small fw-medium">Shipping Address</label>
                        <textarea
                          className="form-control form-control-sm"
                          rows={2}
                          value={form.shipping_address}
                          onChange={(event) => updateForm({ shipping_address: event.target.value })}
                          placeholder="Leave blank to reuse the billing address"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmModal show={!!deleteId} onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleting} />
    </div>
  );
}
