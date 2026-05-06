import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import PageHeader from "../components/shared/PageHeader";
import DataTable from "../components/shared/DataTable";
import ConfirmModal from "../components/shared/ConfirmModal";
import PhoneInput from "../components/shared/PhoneInput";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";

const SALUTATIONS = ["Mr.", "Mrs.", "Ms.", "M/s.", "Dr."];
const EMPTY_FORM = { salutation: "M/s.", name: "", mobile: "", address: "", email: "", gstin: "" };

export default function Vendors() {
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

  const canAddVendors = hasPermission(user, "can_add_vendors");
  const canEditVendors = hasPermission(user, "can_edit_vendors");
  const canDeleteVendors = hasPermission(user, "can_delete_vendors");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/vendors?page=${page}&pageSize=${pageSize}&search=${search}`);
      setData(res.data.data);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch {
      toast.error("Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditId(row.id);
    setForm({
      salutation: row.salutation,
      name: row.name,
      mobile: row.mobile,
      address: row.address,
      email: row.email || "",
      gstin: row.gstin || "",
    });
    setShowModal(true);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!form.name || !form.mobile || !form.address) {
      toast.error("Name, mobile, and address are required");
      return;
    }

    setSaving(true);
    try {
      if (editId) {
        await api.put(`/vendors/${editId}`, form);
        toast.success("Vendor updated");
      } else {
        await api.post("/vendors", form);
        toast.success("Vendor created");
      }
      setShowModal(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/vendors/${deleteId}`);
      toast.success("Vendor deleted");
      setDeleteId(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { key: "code", label: "Code", style: { width: "80px" }, render: (row) => <span className="fw-medium text-primary">{row.code}</span> },
    { key: "name", label: "Name", render: (row) => <><div className="fw-medium">{row.salutation} {row.name}</div>{row.email && <small className="text-muted">{row.email}</small>}</> },
    { key: "mobile", label: "Mobile", style: { width: "120px" } },
    {
      key: "balance",
      label: "Balance",
      style: { width: "130px" },
      render: (row) => {
        const balance = Number(row.balance || 0);
        if (balance === 0) return <span className="text-muted">₹0.00</span>;
        if (balance < 0) return <span className="text-danger fw-medium" title="Pending Amount">Due: ₹{Math.abs(balance).toFixed(2)}</span>;
        return <span className="text-success fw-medium" title="Advance Amount">Adv: ₹{balance.toFixed(2)}</span>;
      },
    },
    { key: "gstin", label: "GSTIN", style: { width: "160px" }, render: (row) => row.gstin || <span className="text-muted">-</span> },
    { key: "address", label: "Address", render: (row) => <small className="text-muted">{row.address?.substring(0, 50)}{row.address?.length > 50 ? "..." : ""}</small> },
  ];

  if (canEditVendors || canDeleteVendors) {
    columns.push({
      key: "actions",
      label: "",
      style: { width: "80px" },
      render: (row) => (
        <div className="d-flex gap-1 justify-content-end">
          {canEditVendors && (
            <button className="btn btn-link btn-sm p-0 text-primary" onClick={(event) => { event.stopPropagation(); openEdit(row); }}>
              <i className="fa-solid fa-pen-to-square"></i>
            </button>
          )}
          {canDeleteVendors && (
            <button className="btn btn-link btn-sm p-0 text-danger" onClick={(event) => { event.stopPropagation(); setDeleteId(row.id); }}>
              <i className="fa-solid fa-trash"></i>
            </button>
          )}
        </div>
      ),
    });
  }

  return (
    <div>
      <PageHeader title="Vendors" icon="fa-solid fa-truck" subtitle={`${total} vendors`}>
        {canAddVendors && (
          <button className="btn btn-primary btn-sm" onClick={openCreate} id="add-vendor-btn">
            <i className="fa-solid fa-plus me-1"></i>Add Vendor
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
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        onSearch={(value) => { setSearch(value); setPage(1); }}
        searchPlaceholder="Search vendors..."
        emptyMessage="No vendors found"
        emptyIcon="fa-solid fa-truck"
      />

      {showModal && (
        <>
          <div className="modal-backdrop fade show" onClick={() => setShowModal(false)}></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow">
                <div className="modal-header"><h6 className="modal-title fw-semibold"><i className="fa-solid fa-truck me-2 text-primary"></i>{editId ? "Edit" : "New"} Vendor</h6><button type="button" className="btn-close" onClick={() => setShowModal(false)}></button></div>
                <form onSubmit={handleSave}>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-4"><label className="form-label small fw-medium">Salutation</label><select className="form-select form-select-sm" value={form.salutation} onChange={(event) => setForm({ ...form, salutation: event.target.value })}>{SALUTATIONS.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
                      <div className="col-8"><label className="form-label small fw-medium">Name *</label><input className="form-control form-control-sm" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></div>
                      <div className="col-6"><label className="form-label small fw-medium">Mobile *</label><PhoneInput className="input-group-sm" value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} required /></div>
                      <div className="col-6"><label className="form-label small fw-medium">Email</label><input type="email" className="form-control form-control-sm" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
                      <div className="col-12"><label className="form-label small fw-medium">Address *</label><textarea className="form-control form-control-sm" rows={2} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} required /></div>
                      <div className="col-12"><label className="form-label small fw-medium">GSTIN</label><input className="form-control form-control-sm" value={form.gstin} onChange={(event) => setForm({ ...form, gstin: event.target.value })} /></div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
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
