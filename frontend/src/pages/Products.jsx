import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import PageHeader from "../components/shared/PageHeader";
import DataTable from "../components/shared/DataTable";
import ConfirmModal from "../components/shared/ConfirmModal";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";
import { GST_RATE_OPTIONS, formatTaxRate } from "../utils/gst";

const PRODUCT_TYPE_OPTIONS = [
  { value: "TRADING_GOODS", label: "Trading Goods", masterType: "GOODS" },
  { value: "MANUFACTURED_GOODS", label: "Manufactured Goods (Own Sale)", masterType: "GOODS" },
  { value: "JOB_WORK_PROCESSING_SERVICE", label: "Job Work / Processing Service", masterType: "JOBWORK" },
  { value: "SERVICES_OTHER", label: "Services (Other)", masterType: "SERVICE" },
];

const EMPTY_FORM = {
  name: "",
  product_type: "TRADING_GOODS",
  hsn_sac_code: "",
  category: "",
  unit: "pcs",
  mrp: "",
  price: "",
  description: "",
  tax_rate: "0",
};

function getProductTypeMeta(productType) {
  return PRODUCT_TYPE_OPTIONS.find((option) => option.value === productType) || PRODUCT_TYPE_OPTIONS[0];
}

function getRateLabel(productType) {
  return productType === "JOB_WORK_PROCESSING_SERVICE" ? "Job Work Charges (Inclusive of GST) *" : "Rate (Inclusive of GST) *";
}

function downloadBarcode(product) {
  import("jsbarcode").then(({ default: JsBarcode }) => {
    const canvas = document.createElement("canvas");

    try {
      JsBarcode(canvas, product.barcode, {
        format: "EAN13",
        width: 2,
        height: 80,
        displayValue: true,
        fontSize: 14,
        margin: 10,
        background: "#ffffff",
        lineColor: "#000000",
      });

      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = canvas.width;
      finalCanvas.height = canvas.height + 28;

      const ctx = finalCanvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
      ctx.font = "bold 14px Arial, sans-serif";
      ctx.fillStyle = "#212529";
      ctx.textAlign = "center";
      ctx.fillText(
        product.name.length > 35 ? `${product.name.slice(0, 32)}...` : product.name,
        finalCanvas.width / 2,
        20
      );
      ctx.drawImage(canvas, 0, 28);

      const link = document.createElement("a");
      link.download = `${product.name.replace(/[^a-z0-9]/gi, "_")}-barcode.png`;
      link.href = finalCanvas.toDataURL("image/png");
      link.click();
    } catch {
      toast.error("Could not generate barcode image. The barcode may be invalid.");
    }
  });
}

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

  const [showHsnModal, setShowHsnModal] = useState(false);
  const [hsnSearch, setHsnSearch] = useState("");
  const [hsnResults, setHsnResults] = useState([]);
  const [hsnLoading, setHsnLoading] = useState(false);
  const [hsnSearchNotice, setHsnSearchNotice] = useState("");
  const [hsnLookup, setHsnLookup] = useState({ state: "idle", message: "", matched: null, requested: false });

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

  const fetchHsnResults = useCallback(async (queryText, productType) => {
    setHsnLoading(true);
    setHsnSearchNotice("");
    try {
      const res = await api.get(`/hsn-sac/search?q=${encodeURIComponent(queryText)}&product_type=${encodeURIComponent(productType)}&limit=40`);
      setHsnResults(res.data.data || []);
      setHsnSearchNotice(res.data.message || "");
    } catch (error) {
      setHsnResults([]);
      setHsnSearchNotice(
        error.response?.data?.error || "Could not load the HSN/SAC list right now. You can still enter the code manually."
      );
    } finally {
      setHsnLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showHsnModal) return;
    const timer = setTimeout(() => {
      fetchHsnResults(hsnSearch, form.product_type);
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchHsnResults, form.product_type, hsnSearch, showHsnModal]);

  function resetHsnLookup() {
    setHsnLookup({ state: "idle", message: "", matched: null, requested: false });
  }

  function closeHsnModal() {
    setShowHsnModal(false);
    setHsnLoading(false);
    setHsnSearch("");
    setHsnResults([]);
    setHsnSearchNotice("");
  }

  function openHsnModal() {
    setHsnSearch("");
    setHsnResults([]);
    setHsnSearchNotice("");
    setShowHsnModal(true);
  }

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    resetHsnLookup();
    setShowModal(true);
  }

  function openEdit(row) {
    setEditId(row.id);
    setForm({
      name: row.name,
      product_type: row.product_type || "TRADING_GOODS",
      hsn_sac_code: row.hsn_sac_code || "",
      category: row.category,
      unit: row.unit,
      mrp: String(row.mrp),
      price: String(row.price),
      description: row.description || "",
      tax_rate: String(row.tax_rate),
    });
    resetHsnLookup();
    setShowModal(true);
  }

  async function verifyManualCode(code, productType) {
    const trimmedCode = String(code || "").trim().toUpperCase();
    if (!trimmedCode) {
      resetHsnLookup();
      return;
    }

    if (productType === "JOB_WORK_PROCESSING_SERVICE") {
      setForm((current) => ({
        ...current,
        hsn_sac_code: "9988",
        tax_rate: "5",
      }));
      setHsnLookup({
        state: "verified",
        message: "SAC 9988 is auto-applied for job work / processing service.",
        matched: { code: "9988", description: "Manufacturing services on physical inputs owned by others", suggested_gst_rate: 5.0, entry_type: "JOBWORK" },
        requested: false,
      });
      return;
    }

    try {
      const res = await api.get(`/hsn-sac/lookup/${encodeURIComponent(trimmedCode)}?product_type=${encodeURIComponent(productType)}`);
      if (res.data.verified) {
        setForm((current) => ({
          ...current,
          hsn_sac_code: trimmedCode,
          tax_rate: String(res.data.data?.suggested_gst_rate ?? current.tax_rate),
        }));
        setHsnLookup({
          state: "verified",
          message: "Verified against the internal HSN/SAC master. GST is auto-filled from the HSN/SAC, and you can still edit it if needed.",
          matched: res.data.data,
          requested: false,
        });
      } else {
        setHsnLookup({
          state: "warning",
          message: "This HSN/SAC was not found in our verified master list. Please verify it on the official GST portal before invoicing.",
          matched: null,
          requested: false,
        });
      }
    } catch {
      setHsnLookup({
        state: "warning",
        message: "Could not verify this HSN/SAC right now. You can still save it and review later.",
        matched: null,
        requested: false,
      });
    }
  }

  function handleProductTypeChange(nextType) {
    if (nextType === "JOB_WORK_PROCESSING_SERVICE") {
      setForm((current) => ({
        ...current,
        product_type: nextType,
        hsn_sac_code: "9988",
        tax_rate: "5",
      }));
      setHsnLookup({
        state: "verified",
        message: "SAC 9988 is auto-applied for job work / processing service. GST is auto-filled and can still be edited.",
        matched: { code: "9988", description: "Manufacturing services on physical inputs owned by others", suggested_gst_rate: 5.0, entry_type: "JOBWORK" },
        requested: false,
      });
      return;
    }

    setForm((current) => ({ ...current, product_type: nextType }));
    resetHsnLookup();
  }

  function selectHsnResult(result) {
    setForm((current) => ({
      ...current,
      hsn_sac_code: result.code,
      tax_rate: String(result.suggested_gst_rate ?? current.tax_rate),
    }));
    setHsnLookup({
      state: "verified",
      message: "GST is auto-filled based on the selected HSN/SAC. Change it if your product has exemption, special notification, or a different applicable rate.",
      matched: result,
      requested: false,
    });
    setShowHsnModal(false);
  }

  async function requestCodeAddition() {
    if (!form.hsn_sac_code.trim()) return;
    try {
      await api.post("/hsn-sac/requests", {
        code: form.hsn_sac_code.trim().toUpperCase(),
        description: form.name || form.description || null,
        product_type: form.product_type,
      });
      setHsnLookup((current) => ({ ...current, requested: true }));
      toast.success("HSN/SAC request submitted for review");
    } catch {
      toast.error("Could not submit the request right now");
    }
  }

  async function handleSave(event) {
    event.preventDefault();

    if (!form.name || !form.category || !form.unit || !form.price || !form.product_type) {
      toast.error("Name, product type, category, unit, and rate are required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        hsn_sac_code: form.product_type === "JOB_WORK_PROCESSING_SERVICE" ? "9988" : form.hsn_sac_code.trim().toUpperCase(),
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
  }

  async function handleDelete() {
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
  }

  const columns = [
    {
      key: "code",
      label: "Code",
      style: { width: "90px" },
      render: (row) => <span className="fw-medium text-primary">{row.code}</span>,
    },
    {
      key: "name",
      label: "Name",
      render: (row) => (
        <>
          <div className="fw-medium">{row.name}</div>
          <small className="text-muted">{row.category}</small>
          <div className="small text-muted">HSN/SAC: {row.hsn_sac_code || "-"}</div>
          <div className="small text-muted">{getProductTypeMeta(row.product_type).label}</div>
          {row.barcode && (
            <div style={{ fontFamily: "monospace", fontSize: "0.68rem", color: "#6c757d", letterSpacing: "0.04em" }}>
              <i className="fa-solid fa-barcode fa-xs me-1" />
              {row.barcode}
            </div>
          )}
        </>
      ),
    },
    { key: "unit", label: "Unit", style: { width: "70px" } },
    {
      key: "price",
      label: "Rate (Incl. GST)",
      style: { width: "140px" },
      cellClassName: "text-end",
      render: (row) => `Rs.${Number(row.price).toLocaleString("en-IN")}`,
    },
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
    {
      key: "tax_rate",
      label: "GST%",
      style: { width: "70px" },
      cellClassName: "text-center",
      render: (row) => `${formatTaxRate(row.tax_rate)}%`,
    },
  ];

  if (canEditProducts || canDeleteProducts) {
    columns.push({
      key: "actions",
      label: "",
      style: { width: "110px" },
      render: (row) => (
        <div className="d-flex gap-1 justify-content-end align-items-center">
          {row.barcode && (
            <button
              className="btn btn-link btn-sm p-0 text-secondary"
              title="Download barcode"
              onClick={(event) => {
                event.stopPropagation();
                downloadBarcode(row);
              }}
              id={`download-barcode-${row.id}`}
            >
              <i className="fa-solid fa-barcode" />
            </button>
          )}
          {canEditProducts && (
            <button
              className="btn btn-link btn-sm p-0 text-primary"
              title="Edit product"
              onClick={(event) => {
                event.stopPropagation();
                openEdit(row);
              }}
            >
              <i className="fa-solid fa-pen-to-square" />
            </button>
          )}
          {canDeleteProducts && (
            <button
              className="btn btn-link btn-sm p-0 text-danger"
              title="Delete product"
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

  const productTypeMeta = getProductTypeMeta(form.product_type);
  const isManualWarning = hsnLookup.state === "warning";

  return (
    <div>
      <PageHeader title="Products" icon="fa-solid fa-box" subtitle={`${total} products`}>
        {canAddProducts && (
          <button className="btn btn-primary btn-sm" onClick={openCreate} id="add-product-btn">
            <i className="fa-solid fa-plus me-1" />
            Add Product
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
        searchPlaceholder="Search products or barcode..."
        emptyMessage="No products found"
        emptyIcon="fa-solid fa-box-open"
      />

      {showModal && (
        <>
          <div className="modal-backdrop fade show" onClick={() => setShowModal(false)} />
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content border-0 shadow">
                <div className="modal-header">
                  <h6 className="modal-title fw-semibold">
                    <i className="fa-solid fa-box me-2 text-primary" />
                    {editId ? "Edit Product" : "New Product"}
                  </h6>
                  <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
                </div>

                <form onSubmit={handleSave}>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-12 col-md-7">
                        <label className="form-label small fw-medium">Name *</label>
                        <input
                          className="form-control form-control-sm"
                          value={form.name}
                          onChange={(event) => setForm({ ...form, name: event.target.value })}
                          required
                        />
                      </div>
                      <div className="col-12 col-md-5">
                        <label className="form-label small fw-medium">Product Type *</label>
                        <select
                          className="form-select form-select-sm"
                          value={form.product_type}
                          onChange={(event) => handleProductTypeChange(event.target.value)}
                        >
                          {PRODUCT_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-6 col-md-4">
                        <label className="form-label small fw-medium">Unit *</label>
                        <input
                          className="form-control form-control-sm"
                          value={form.unit}
                          onChange={(event) => setForm({ ...form, unit: event.target.value })}
                          required
                        />
                      </div>
                      <div className="col-12 col-md-8">
                        <label className="form-label small fw-medium">HSN / SAC (Optional)</label>
                        <div className="input-group input-group-sm">
                          <input
                            className="form-control text-uppercase"
                            value={form.hsn_sac_code}
                            onChange={(event) => {
                              setForm({ ...form, hsn_sac_code: event.target.value.toUpperCase() });
                              resetHsnLookup();
                            }}
                            onBlur={() => verifyManualCode(form.hsn_sac_code, form.product_type)}
                            disabled={form.product_type === "JOB_WORK_PROCESSING_SERVICE"}
                          />
                          <button
                            type="button"
                            className="btn btn-outline-primary"
                            onClick={openHsnModal}
                          >
                            Search HSN/SAC
                          </button>
                        </div>
                        {hsnLookup.message && (
                          <div className={`mt-2 small ${hsnLookup.state === "warning" ? "text-warning-emphasis" : "text-muted"}`}>
                            {hsnLookup.message}
                          </div>
                        )}
                        {!form.hsn_sac_code && form.product_type !== "JOB_WORK_PROCESSING_SERVICE" && (
                          <div className="mt-2 small text-muted">
                            Leave this blank if you do not want to mention HSN/SAC for this product.
                          </div>
                        )}
                        {isManualWarning && (
                          <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
                            <button type="button" className="btn btn-outline-warning btn-sm" onClick={requestCodeAddition} disabled={hsnLookup.requested}>
                              {hsnLookup.requested ? "Request Submitted" : "Request to Add"}
                            </button>
                            <small className="text-muted">Manual entry is allowed. You can still save this product.</small>
                          </div>
                        )}
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-medium">Category *</label>
                        <input
                          className="form-control form-control-sm"
                          value={form.category}
                          onChange={(event) => setForm({ ...form, category: event.target.value })}
                          required
                        />
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-medium">GST Rate *</label>
                        <input
                          type="number"
                          list="gst-rate-suggestions"
                          className="form-control form-control-sm"
                          value={form.tax_rate}
                          onChange={(event) => setForm({ ...form, tax_rate: event.target.value })}
                          min="0"
                          max="100"
                          step="0.001"
                          required
                        />
                        <div className="small text-muted mt-1">
                          This is auto-filled from the HSN/SAC by default, but you can still edit it if a special case applies.
                        </div>
                      </div>
                      <div className="col-6">
                        <label className="form-label small fw-medium">MRP (Optional)</label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          value={form.mrp}
                          onChange={(event) => setForm({ ...form, mrp: event.target.value })}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label small fw-medium">{getRateLabel(form.product_type)}</label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          value={form.price}
                          onChange={(event) => setForm({ ...form, price: event.target.value })}
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label small fw-medium">Description</label>
                        <textarea
                          className="form-control form-control-sm"
                          rows={2}
                          value={form.description}
                          onChange={(event) => setForm({ ...form, description: event.target.value })}
                        />
                      </div>
                    </div>

                    <div className="mt-3 p-2 bg-light rounded border">
                      <small className="text-muted">
                        <i className="fa-solid fa-circle-info me-1 text-info" />
                        {productTypeMeta.value === "JOB_WORK_PROCESSING_SERVICE"
                          ? "Job work items force SAC 9988 and should be billed only on job work charges."
                          : productTypeMeta.masterType === "SERVICE"
                            ? "Service products should use SAC codes, usually beginning with 99."
                            : "Goods products should use the applicable HSN code for the item sold."}
                      </small>
                    </div>
                  </div>

                  <datalist id="gst-rate-suggestions">
                    {GST_RATE_OPTIONS.map((rate) => (
                      <option key={rate} value={rate}>
                        {formatTaxRate(rate)}%
                      </option>
                    ))}
                  </datalist>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
                      {saving ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-1" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-floppy-disk me-1" />
                          Save
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {showHsnModal && (
        <>
          <div className="modal-backdrop fade show" onClick={closeHsnModal} />
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1060 }}>
            <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
              <div className="modal-content border-0 shadow">
                <div className="modal-header">
                  <div>
                    <h6 className="modal-title fw-semibold mb-1">Search HSN / SAC</h6>
                    <div className="small text-muted">{getProductTypeMeta(form.product_type).label}</div>
                  </div>
                  <button type="button" className="btn-close" onClick={closeHsnModal} />
                </div>
                <div className="modal-body">
                  <input
                    className="form-control form-control-sm mb-3"
                    placeholder="Search by code, product name, or keywords..."
                    value={hsnSearch}
                    onChange={(event) => setHsnSearch(event.target.value)}
                    autoFocus
                  />

                  {hsnSearchNotice && (
                    <div className={`alert py-2 small mb-3 ${hsnResults.length > 0 ? "alert-warning" : "alert-secondary"}`}>
                      {hsnSearchNotice}
                    </div>
                  )}

                  {hsnLoading ? (
                    <div className="text-center py-4">
                      <div className="spinner-border spinner-border-sm text-primary me-2" />
                      <span className="text-muted small">Searching...</span>
                    </div>
                  ) : hsnResults.length === 0 ? (
                    <div className="border rounded p-3 bg-light small text-muted">
                      <div>No verified match found in the internal list. You can still type the HSN/SAC manually and save the product.</div>
                      <div className="mt-3 d-flex gap-2 flex-wrap">
                        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={closeHsnModal}>
                          Use Manual Entry
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => fetchHsnResults(hsnSearch, form.product_type)}
                        >
                          Retry Search
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm align-middle">
                        <thead className="table-light">
                          <tr>
                            <th>Code</th>
                            <th>Description</th>
                            <th>Suggested GST</th>
                            <th>Type</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {hsnResults.map((result) => (
                            <tr key={result.code}>
                              <td className="fw-semibold">{result.code}</td>
                              <td>
                                <div>{result.description}</div>
                                {result.chapter && <div className="small text-muted">{result.chapter}</div>}
                              </td>
                              <td>{formatTaxRate(result.suggested_gst_rate)}%</td>
                              <td>{result.entry_type}</td>
                              <td className="text-end">
                                <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => selectHsnResult(result)}>
                                  Use
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmModal show={!!deleteId} onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleting} />
    </div>
  );
}
