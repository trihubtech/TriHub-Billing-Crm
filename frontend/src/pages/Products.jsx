import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import PageHeader from "../components/shared/PageHeader";
import DataTable from "../components/shared/DataTable";
import ConfirmModal from "../components/shared/ConfirmModal";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";

const EMPTY_FORM = { name: "", category: "", unit: "pcs", mrp: "", price: "", description: "", tax_rate: "0" };

export default function Products() {
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

  const canAddProducts = hasPermission(user, "can_add_products");
  const canEditProducts = hasPermission(user, "can_edit_products");
  const canDeleteProducts = hasPermission(user, "can_delete_products");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/products?page=${page}&pageSize=${pageSize}&search=${search}`);
      setData(res.data.data);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch {
      toast.error("Failed to load products");
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
      name: row.name,
      category: row.category,
      unit: row.unit,
      mrp: String(row.mrp),
      price: String(row.price),
      description: row.description || "",
      tax_rate: String(row.tax_rate),
    });
    setShowModal(true);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!form.name || !form.category || !form.unit) {
      toast.error("Name, category, and unit are required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        mrp: Number(form.mrp) || 0,
        price: Number(form.price) || 0,
        tax_rate: Number(form.tax_rate) || 0,
      };

      if (editId) {
        await api.put(`/products/${editId}`, payload);
        toast.success("Product updated");
      } else {
        await api.post("/products", payload);
        toast.success("Product created");
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
      await api.delete(`/products/${deleteId}`);
      toast.success("Product deleted");
      setDeleteId(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { key: "code", label: "Code", style: { width: "90px" }, render: (row) => <span className="fw-medium text-primary">{row.code}</span> },
    { key: "name", label: "Name", render: (row) => <><div className="fw-medium">{row.name}</div><small className="text-muted">{row.category}</small></> },
    { key: "unit", label: "Unit", style: { width: "70px" } },
    { key: "price", label: "Price", style: { width: "100px" }, cellClassName: "text-end", render: (row) => `₹${Number(row.price).toLocaleString("en-IN")}` },
    {
      key: "current_stock",
      label: "Stock",
      style: { width: "80px" },
      cellClassName: "text-end",
      render: (row) => (
        <span className={Number(row.current_stock) < 5 ? "text-danger fw-semibold" : ""}>
          {row.current_stock ?? 0}
        </span>
      ),
    },
    { key: "tax_rate", label: "Tax%", style: { width: "60px" }, cellClassName: "text-center", render: (row) => (row.tax_rate > 0 ? `${row.tax_rate}%` : "-") },
  ];

  if (canEditProducts || canDeleteProducts) {
    columns.push({
      key: "actions",
      label: "",
      style: { width: "80px" },
      render: (row) => (
        <div className="d-flex gap-1 justify-content-end">
          {canEditProducts && (
            <button className="btn btn-link btn-sm p-0 text-primary" onClick={(event) => { event.stopPropagation(); openEdit(row); }}>
              <i className="fa-solid fa-pen-to-square"></i>
            </button>
          )}
          {canDeleteProducts && (
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
      <PageHeader title="Products" icon="fa-solid fa-box" subtitle={`${total} products`}>
        {canAddProducts && (
          <button className="btn btn-primary btn-sm" onClick={openCreate} id="add-product-btn">
            <i className="fa-solid fa-plus me-1"></i>Add Product
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
        searchPlaceholder="Search products..."
        emptyMessage="No products found"
        emptyIcon="fa-solid fa-box-open"
      />

      {showModal && (
        <>
          <div className="modal-backdrop fade show" onClick={() => setShowModal(false)}></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow">
                <div className="modal-header">
                  <h6 className="modal-title fw-semibold">
                    <i className="fa-solid fa-box me-2 text-primary"></i>
                    {editId ? "Edit Product" : "New Product"}
                  </h6>
                  <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                </div>
                <form onSubmit={handleSave}>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-8"><label className="form-label small fw-medium">Name *</label><input className="form-control form-control-sm" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></div>
                      <div className="col-4"><label className="form-label small fw-medium">Unit *</label><input className="form-control form-control-sm" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} required /></div>
                      <div className="col-6"><label className="form-label small fw-medium">Category *</label><input className="form-control form-control-sm" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required /></div>
                      <div className="col-6"><label className="form-label small fw-medium">Tax Rate (%)</label><input type="number" className="form-control form-control-sm" value={form.tax_rate} onChange={(event) => setForm({ ...form, tax_rate: event.target.value })} min="0" max="100" step="0.01" /></div>
                      <div className="col-6"><label className="form-label small fw-medium">MRP (₹)</label><input type="number" className="form-control form-control-sm" value={form.mrp} onChange={(event) => setForm({ ...form, mrp: event.target.value })} min="0" step="0.01" /></div>
                      <div className="col-6"><label className="form-label small fw-medium">Selling Price (₹)</label><input type="number" className="form-control form-control-sm" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} min="0" step="0.01" /></div>
                      <div className="col-12"><label className="form-label small fw-medium">Description</label><textarea className="form-control form-control-sm" rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
                      {saving ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : <><i className="fa-solid fa-floppy-disk me-1"></i>Save</>}
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
