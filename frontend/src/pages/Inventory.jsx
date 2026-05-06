import { useState, useEffect, useCallback } from "react";
import Select from "react-select";
import { toast } from "react-toastify";
import PageHeader from "../components/shared/PageHeader";
import DataTable from "../components/shared/DataTable";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";

export default function Inventory() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ product_id: "", adjustment: "", reason: "" });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [saving, setSaving] = useState(false);

  const canAdjustInventory = hasPermission(user, "can_add_inventory") && hasPermission(user, "can_list_products");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/inventory?page=${page}&pageSize=${pageSize}&search=${search}`);
      setData(res.data.data);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch {
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openAdjust = async () => {
    try {
      const res = await api.get("/products?pageSize=500&active=1");
      setProducts(res.data.data.map((product) => ({
        value: product.id,
        label: `${product.code} - ${product.name} (Stock: ${product.current_stock})`,
        data: product,
      })));
    } catch {
    }

    setForm({ product_id: "", adjustment: "", reason: "" });
    setSelectedProduct(null);
    setShowModal(true);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!form.product_id || !form.adjustment || !form.reason) {
      toast.error("All fields are required");
      return;
    }

    setSaving(true);
    try {
      await api.post("/inventory", {
        product_id: Number(form.product_id),
        adjustment: Number(form.adjustment),
        reason: form.reason,
      });
      toast.success("Stock adjusted");
      setShowModal(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to adjust stock");
    } finally {
      setSaving(false);
    }
  };

  const typeColors = { MANUAL: "secondary", SALE: "danger", SALE_RETURN: "success", PURCHASE: "primary", PURCHASE_RETURN: "warning" };

  const columns = [
    { key: "code", label: "Code", style: { width: "90px" }, render: (row) => <span className="fw-medium">{row.code}</span> },
    { key: "date", label: "Date", style: { width: "100px" }, render: (row) => new Date(row.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) },
    { key: "product_name", label: "Product", render: (row) => <><div className="fw-medium">{row.product_name}</div><small className="text-muted">{row.product_code}</small></> },
    { key: "type", label: "Type", style: { width: "110px" }, render: (row) => <span className={`badge bg-${typeColors[row.type] || "secondary"} bg-opacity-10 text-${typeColors[row.type] || "secondary"}`} style={{ fontSize: "0.7rem" }}>{row.type.replace("_", " ")}</span> },
    { key: "adjustment", label: "Adj", style: { width: "70px" }, cellClassName: "text-end", render: (row) => <span className={row.adjustment > 0 ? "text-success" : "text-danger"}>{row.adjustment > 0 ? "+" : ""}{row.adjustment}</span> },
    { key: "current_qty", label: "Before", style: { width: "70px" }, cellClassName: "text-end" },
    { key: "new_qty", label: "After", style: { width: "70px" }, cellClassName: "text-end fw-semibold" },
    { key: "reason", label: "Reason", render: (row) => <small className="text-muted">{row.reason}</small> },
  ];

  return (
    <div>
      <PageHeader title="Inventory" icon="fa-solid fa-warehouse" subtitle={`${total} entries`}>
        {canAdjustInventory && (
          <button className="btn btn-primary btn-sm" onClick={openAdjust} id="adjust-stock-btn">
            <i className="fa-solid fa-sliders me-1"></i>Manual Adjustment
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
        searchPlaceholder="Search inventory..."
        emptyMessage="No inventory entries"
        emptyIcon="fa-solid fa-warehouse"
      />

      {showModal && (
        <>
          <div className="modal-backdrop fade show" onClick={() => setShowModal(false)}></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow">
                <div className="modal-header"><h6 className="modal-title fw-semibold"><i className="fa-solid fa-sliders me-2 text-primary"></i>Manual Stock Adjustment</h6><button type="button" className="btn-close" onClick={() => setShowModal(false)}></button></div>
                <form onSubmit={handleSave}>
                  <div className="modal-body">
                    <div className="mb-3"><label className="form-label small fw-medium">Product *</label>
                      <Select options={products} value={selectedProduct} onChange={(option) => { setSelectedProduct(option); setForm({ ...form, product_id: option?.value || "" }); }} placeholder="Search product..." isClearable />
                    </div>
                    <div className="mb-3"><label className="form-label small fw-medium">Adjustment Qty *</label>
                      <input type="number" className="form-control form-control-sm" value={form.adjustment} onChange={(event) => setForm({ ...form, adjustment: event.target.value })} placeholder="e.g. +10 or -5" required />
                      <small className="text-muted">Positive to add stock, negative to reduce</small>
                    </div>
                    <div className="mb-3"><label className="form-label small fw-medium">Reason *</label>
                      <input className="form-control form-control-sm" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="e.g. Damaged goods, Physical count" required />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>{saving ? "Adjusting..." : "Adjust Stock"}</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
