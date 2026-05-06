import { useState, useEffect, useCallback } from "react";
import Select from "react-select";
import { useNavigate, useParams } from "react-router-dom";
import { calcItemTotals, calcInvoiceTotals, newItemDraft, formatCurrency, todayISO } from "../../utils/invoiceUtils";
import api from "../../utils/api";
import { toast } from "react-toastify";
import PhoneInput from "../shared/PhoneInput";

const selectStyles = {
  control: (base, state) => ({ ...base, minHeight: "38px", borderColor: state.isFocused ? "#0d6efd" : "#dee2e6", boxShadow: state.isFocused ? "0 0 0 0.2rem rgba(13,110,253,.25)" : "none", "&:hover": { borderColor: "#0d6efd" }, borderRadius: "0.375rem", fontSize: "0.875rem" }),
  menu: (base) => ({ ...base, zIndex: 1050, fontSize: "0.875rem" }),
  option: (base, state) => ({ ...base, backgroundColor: state.isSelected ? "#0d6efd" : state.isFocused ? "#e8f0fe" : "#fff", color: state.isSelected ? "#fff" : "#212529", padding: "6px 12px" }),
  indicatorSeparator: () => ({ display: "none" }),
};

const PAYMENT_TERMS = [
  { value: "CASH", label: "Cash" }, { value: "CARD", label: "Card" },
  { value: "UPI", label: "UPI" }, { value: "CREDIT", label: "Credit" },
];

export default function BillForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [billCode, setBillCode] = useState("");
  const [date, setDate] = useState(todayISO());
  const [term, setTerm] = useState(PAYMENT_TERMS[0]);
  const [vendor, setVendor] = useState(null);
  const [vendorInvNo, setVendorInvNo] = useState("");
  const [discount, setDiscount] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([newItemDraft()]);
  const [totals, setTotals] = useState({ subTotal: 0, totalTax: 0, roundOff: 0, grandTotal: 0, amountInWords: "" });

  const [vendorOptions, setVendorOptions] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const SALUTATIONS = ["Mr.", "Mrs.", "Ms.", "M/s.", "Dr."];
  const EMPTY_VENDOR_FORM = { salutation: "M/s.", name: "", mobile: "", address: "", email: "", gstin: "" };
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [vendorForm, setVendorForm] = useState(EMPTY_VENDOR_FORM);
  const [savingVendor, setSavingVendor] = useState(false);

  const hasTax = items.some(i => (i.taxRate || 0) > 0);

  useEffect(() => {
    async function fetchOptions() {
      try {
        const [vendRes, prodRes] = await Promise.all([
          api.get("/vendors?pageSize=500&active=1"),
          api.get("/products?pageSize=500&active=1"),
        ]);
        setVendorOptions(vendRes.data.data.map(v => ({ value: v.id, label: `${v.code} \u2014 ${v.salutation} ${v.name}`, data: v })));
        setProductOptions(prodRes.data.data.map(p => ({ value: p.id, label: `${p.code} \u2014 ${p.name} (${p.unit})`, data: p })));
      } catch {
        toast.error("Failed to load data");
      }
    }
    fetchOptions();
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    async function fetchBill() {
      try {
        const res = await api.get(`/bills/${id}`);
        const b = res.data.data;
        setBillCode(b.code);
        setDate(b.date.split("T")[0]);
        setTerm(PAYMENT_TERMS.find(t => t.value === b.term) || PAYMENT_TERMS[0]);
        setVendor({ value: b.vendor_id, label: `${b.vendor_code} \u2014 ${b.vendor_salutation} ${b.vendor_name}`, data: { ...b, balance: b.previous_balance } });
        setVendorInvNo(b.vendor_invoice_number || "");
        setDiscount(b.discount > 0 ? String(b.discount) : "");
        setPaidAmount(b.paid_amount > 0 ? String(b.paid_amount) : "");
        setNotes(b.notes || "");
        setItems(b.items.map(item => ({
          _key: `edit_${item.id}`, product_id: item.product_id,
          product: { id: item.product_id, name: item.product_name, code: item.product_code, unit: item.product_unit, tax_rate: item.tax_rate },
          rate: String(item.rate), quantity: String(item.quantity), value: Number(item.value),
          taxRate: Number(item.tax_rate), taxValue: Number(item.tax_value), totalValue: Number(item.total_value),
        })));
      } catch {
        toast.error("Failed to load bill");
        navigate("/bills");
      } finally {
        setLoading(false);
      }
    }
    fetchBill();
  }, [id, isEdit, navigate]);

  useEffect(() => { setTotals(calcInvoiceTotals(items, discount)); }, [items, discount]);

  const updateItem = useCallback((key, patch) => {
    setItems(prev => prev.map(item => {
      if (item._key !== key) return item;
      const updated = { ...item, ...patch };
      if ("rate" in patch || "quantity" in patch || "taxRate" in patch) {
        const { value, taxValue, totalValue } = calcItemTotals(
          "rate" in patch ? patch.rate : updated.rate,
          "quantity" in patch ? patch.quantity : updated.quantity,
          "taxRate" in patch ? patch.taxRate : updated.taxRate
        );
        return { ...updated, value, taxValue, totalValue };
      }
      return updated;
    }));
  }, []);

  const selectProduct = useCallback((key, option) => {
    if (!option) {
      updateItem(key, { product_id: "", product: null, rate: "", taxRate: 0, value: 0, taxValue: 0, totalValue: 0 });
      return;
    }
    const p = option.data;
    updateItem(key, { product_id: p.id, product: p, rate: String(p.price), taxRate: Number(p.tax_rate) });
  }, [updateItem]);

  const addItem = useCallback(() => setItems(prev => [...prev, newItemDraft()]), []);
  const removeItem = useCallback((key) => setItems(prev => prev.length === 1 ? prev : prev.filter(i => i._key !== key)), []);

  const handleAddVendor = async (e) => {
    e.preventDefault();
    if (!vendorForm.name || !vendorForm.mobile || !vendorForm.address) {
      toast.error("Name, mobile, and address are required");
      return;
    }
    setSavingVendor(true);
    try {
      const res = await api.post("/vendors", vendorForm);
      const v = res.data.data;
      const newOpt = {
        value: v.id,
        label: `${v.code} \u2014 ${v.salutation} ${v.name}`,
        data: v,
      };
      setVendorOptions(prev => [...prev, newOpt]);
      setVendor(newOpt);
      setShowAddVendor(false);
      setVendorForm(EMPTY_VENDOR_FORM);
      toast.success("Vendor created & selected!");
    } catch (error) {
      let message = error.response?.data?.error || "Failed to create vendor";
      if (error.response?.data?.details) {
        message = Object.values(error.response.data.details).map((d) => d.msg).join(", ");
      }
      toast.error(message);
    } finally {
      setSavingVendor(false);
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!date) errs.date = "Required";
    if (!vendor) errs.vendor = "Required";
    if (!vendorInvNo) errs.vendorInvNo = "Required";
    items.forEach((item, idx) => {
      if (!item.product_id) errs[`item_${idx}_product`] = "Select product";
      if (!item.rate || Number(item.rate) <= 0) errs[`item_${idx}_rate`] = "Invalid";
      if (!item.quantity || Number(item.quantity) <= 0) errs[`item_${idx}_quantity`] = "Invalid";
    });
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Please fix errors");
      return;
    }

    setSubmitting(true);
    const payload = {
      date,
      term: term.value,
      vendor_id: vendor.value,
      vendor_invoice_number: vendorInvNo,
      discount: Number(discount) || 0,
      paid_amount: Number(paidAmount) || 0,
      notes: notes || null,
      items: items.map(i => ({ product_id: i.product_id, rate: Number(i.rate), quantity: Number(i.quantity) })),
    };

    try {
      if (isEdit) {
        await api.put(`/bills/${id}`, payload);
        toast.success("Bill updated");
      } else {
        const res = await api.post("/bills", payload);
        toast.success("Bill created");
        navigate(`/bills/${res.data.data.id}/view`);
        return;
      }
      navigate("/bills");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="d-flex justify-content-center py-5"><div className="spinner-border text-primary" /></div>;

  return (
    <div className="invoice-form-wrapper">
      <form onSubmit={handleSubmit} noValidate>
        <div className="d-flex flex-wrap align-items-center justify-content-between mb-3 gap-2">
          <div>
            <h5 className="mb-0 fw-semibold"><i className="fa-solid fa-file-invoice-dollar me-2 text-primary"></i>{isEdit ? "Edit Bill" : "New Bill"}</h5>
            {billCode && <small className="text-muted">Code: <strong>{billCode}</strong></small>}
          </div>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => navigate("/bills")}><i className="fa-solid fa-arrow-left me-1"></i>Back</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? <><span className="spinner-border spinner-border-sm me-1" />Saving{"\u2026"}</> : <><i className="fa-solid fa-floppy-disk me-1"></i>{isEdit ? "Update" : "Save Bill"}</>}
            </button>
          </div>
        </div>

        <div className="card border-0 shadow-sm mb-3"><div className="card-body"><div className="row g-3">
          <div className="col-6 col-md-3"><label className="form-label fw-medium small mb-1">Date *</label><input type="date" className="form-control form-control-sm" value={date} onChange={e => setDate(e.target.value)} max={todayISO()} /></div>
          <div className="col-6 col-md-3"><label className="form-label fw-medium small mb-1">Term *</label><Select options={PAYMENT_TERMS} value={term} onChange={setTerm} styles={selectStyles} /></div>
          <div className="col-12 col-md-6">
            <div className="d-flex align-items-center justify-content-between mb-1">
              <label className="form-label fw-medium small mb-0">Vendor <span className="text-danger">*</span></label>
              <button
                type="button"
                className="btn btn-outline-success btn-sm py-0 px-2"
                style={{ fontSize: "0.75rem", lineHeight: "1.6" }}
                onClick={() => setShowAddVendor(true)}
                title="Add new vendor"
                id="add-vendor-inline-btn"
              >
                <i className="fa-solid fa-truck me-1"></i>New
              </button>
            </div>
            <Select options={vendorOptions} value={vendor} onChange={setVendor} styles={selectStyles} placeholder={"Search vendor\u2026"} isClearable />
          </div>
          <div className="col-12 col-md-6"><label className="form-label fw-medium small mb-1">Vendor Invoice # *</label><input className="form-control form-control-sm" value={vendorInvNo} onChange={e => setVendorInvNo(e.target.value)} placeholder="Vendor's own invoice number" />{errors.vendorInvNo && <div className="text-danger" style={{ fontSize: "0.75rem" }}>{errors.vendorInvNo}</div>}</div>
        </div></div></div>

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-header bg-white border-bottom py-2 d-flex justify-content-between align-items-center">
            <span className="fw-semibold small"><i className="fa-solid fa-list me-2 text-primary"></i>Products</span>
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={addItem}><i className="fa-solid fa-plus me-1"></i>Add Row</button>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive d-none d-md-block">
              <table className="table table-sm table-hover align-middle mb-0 bill-items-table">
                <thead className="table-light"><tr>
                  <th style={{ width: "34px" }} className="text-center">#</th>
                  <th style={{ minWidth: "180px" }}>Product</th>
                  <th style={{ width: "100px" }}>Rate ({"\u20B9"})</th>
                  <th style={{ width: "90px" }}>Qty</th>
                  <th style={{ width: "110px" }}>Value ({"\u20B9"})</th>
                  {hasTax && <th style={{ width: "80px" }}>Tax %</th>}
                  {hasTax && <th style={{ width: "100px" }}>Tax ({"\u20B9"})</th>}
                  <th style={{ width: "115px" }}>Total ({"\u20B9"})</th>
                  <th style={{ width: "40px" }}></th>
                </tr></thead>
                <tbody>{items.map((item, idx) => {
                  const selProd = item.product_id ? productOptions.find(o => o.value === item.product_id) || null : null;
                  return (
                    <tr key={item._key}>
                      <td className="text-center text-muted small">{idx + 1}</td>
                      <td><Select options={productOptions} value={selProd} onChange={(opt) => selectProduct(item._key, opt)} menuPortalTarget={document.body} styles={{ ...selectStyles, menuPortal: base => ({ ...base, zIndex: 9999 }), control: (b, s) => ({ ...selectStyles.control(b, s), minHeight: "31px", height: "31px" }) }} placeholder={"Search\u2026"} isClearable /></td>
                      <td><input type="number" className="form-control form-control-sm text-end" value={item.rate} onChange={e => updateItem(item._key, { rate: e.target.value })} min="0" step="0.01" /></td>
                      <td><input type="number" className="form-control form-control-sm text-end" value={item.quantity} onChange={e => updateItem(item._key, { quantity: e.target.value })} min="0" step="0.001" /></td>
                      <td className="text-end small">{formatCurrency(item.value)}</td>
                      {hasTax && <td className="text-center small text-muted">{item.taxRate > 0 ? `${item.taxRate}%` : "\u2014"}</td>}
                      {hasTax && <td className="text-end small">{item.taxRate > 0 ? formatCurrency(item.taxValue) : "\u2014"}</td>}
                      <td className="text-end fw-semibold small">{formatCurrency(item.totalValue)}</td>
                      <td className="text-center"><button type="button" className="btn btn-link btn-sm p-0 text-danger" onClick={() => removeItem(item._key)} disabled={items.length === 1} style={{ opacity: items.length > 1 ? 1 : 0.3 }}><i className="fa-solid fa-trash-can"></i></button></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>

            <div className="d-md-none p-2">
              {items.map((item, idx) => {
                const selProd = item.product_id ? productOptions.find(o => o.value === item.product_id) || null : null;
                return (
                  <div key={`mobile_${item._key}`} className="bg-white border rounded-3 shadow-sm p-3 mb-2">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <span className="small fw-semibold text-muted text-uppercase">Item {idx + 1}</span>
                      <button type="button" className="btn btn-link btn-sm p-0 text-danger" onClick={() => removeItem(item._key)} disabled={items.length === 1} style={{ opacity: items.length > 1 ? 1 : 0.3 }}><i className="fa-solid fa-trash-can"></i></button>
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-medium small mb-1">Product</label>
                      <Select options={productOptions} value={selProd} onChange={(opt) => selectProduct(item._key, opt)} menuPortalTarget={document.body} styles={{ ...selectStyles, menuPortal: base => ({ ...base, zIndex: 9999 }) }} placeholder={"Search\u2026"} isClearable />
                    </div>

                    <div className="row g-2 mb-3">
                      <div className="col-6">
                        <label className="form-label fw-medium small mb-1">Rate</label>
                        <input type="number" className="form-control form-control-sm text-end" value={item.rate} onChange={e => updateItem(item._key, { rate: e.target.value })} min="0" step="0.01" />
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-medium small mb-1">Qty</label>
                        <input type="number" className="form-control form-control-sm text-end" value={item.quantity} onChange={e => updateItem(item._key, { quantity: e.target.value })} min="0" step="0.001" />
                      </div>
                    </div>

                    <div className="border rounded-3 bg-light px-2 py-1">
                      <div className="d-flex justify-content-between align-items-center py-1 small">
                        <span className="text-muted">Value</span>
                        <span className="fw-medium">{formatCurrency(item.value)}</span>
                      </div>
                      {hasTax && <div className="d-flex justify-content-between align-items-center py-1 small border-top"><span className="text-muted">Tax %</span><span className="fw-medium">{item.taxRate > 0 ? `${item.taxRate}%` : "\u2014"}</span></div>}
                      {hasTax && <div className="d-flex justify-content-between align-items-center py-1 small border-top"><span className="text-muted">Tax</span><span className="fw-medium">{item.taxRate > 0 ? formatCurrency(item.taxValue) : "\u2014"}</span></div>}
                      <div className="d-flex justify-content-between align-items-center py-1 small border-top">
                        <span className="text-muted">Total</span>
                        <span className="fw-semibold text-primary">{formatCurrency(item.totalValue)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="row g-3 mb-4">
          <div className="col-12 col-md-6"><div className="card border-0 shadow-sm h-100"><div className="card-body">
            <label className="form-label fw-medium small">Notes (optional)</label>
            <textarea className="form-control form-control-sm" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
            {totals.grandTotal > 0 && <div className="mt-2 p-2 rounded bg-light border"><small className="text-muted d-block" style={{ fontSize: "0.7rem", textTransform: "uppercase" }}>Amount in Words</small><span className="fw-medium" style={{ fontSize: "0.8rem" }}>{totals.amountInWords}</span></div>}
          </div></div></div>
          <div className="col-12 col-md-6"><div className="card border-0 shadow-sm"><div className="card-body">
            <table className="table table-sm table-borderless mb-0"><tbody>
              <tr><td className="text-muted small py-1">Sub Total</td><td className="text-end fw-medium small py-1">{"\u20B9"} {formatCurrency(totals.subTotal)}</td></tr>
              {hasTax && <tr><td className="text-muted small py-1">Tax (GST)</td><td className="text-end fw-medium small py-1">{"\u20B9"} {formatCurrency(totals.totalTax)}</td></tr>}
              <tr><td className="py-1"><span className="text-muted small">Discount ({"\u20B9"})</span></td><td className="text-end py-1"><input type="number" className="form-control form-control-sm text-end" value={discount} onChange={e => setDiscount(e.target.value)} min="0" step="0.01" placeholder="0.00" style={{ maxWidth: "110px", marginLeft: "auto" }} /></td></tr>

              {vendor?.data?.balance !== undefined && Number(vendor.data.balance) !== 0 && (
                <tr>
                  <td className="py-1"><span className="text-muted small">Previous Balance ({"\u20B9"})</span></td>
                  <td className="text-end fw-medium small py-1">
                    <span className={Number(vendor.data.balance) < 0 ? "text-danger" : "text-success"}>
                      {Number(vendor.data.balance) < 0 ? "Due: " : "Adv: "}{"\u20B9"} {formatCurrency(Math.abs(Number(vendor.data.balance)))}
                    </span>
                  </td>
                </tr>
              )}

              {vendor?.data?.balance !== undefined && (
                <tr className="border-top">
                  <td className="py-1 fw-medium small">Net Payable</td>
                  <td className="text-end fw-bold small py-1">
                    {"\u20B9"} {formatCurrency(totals.grandTotal - Number(vendor.data.balance || 0))}
                  </td>
                </tr>
              )}

              <tr><td className="py-1"><span className="text-muted small">Paid Amt ({"\u20B9"})</span></td><td className="text-end py-1"><input type="number" className="form-control form-control-sm text-end" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} min="0" step="0.01" placeholder="0.00" style={{ maxWidth: "110px", marginLeft: "auto" }} /></td></tr>
              {totals.roundOff !== 0 && <tr><td className="text-muted small py-1">Round Off</td><td className="text-end fw-medium small py-1">{totals.roundOff > 0 ? "+" : ""}{"\u20B9"} {formatCurrency(totals.roundOff)}</td></tr>}
              <tr className="border-top"><td className="fw-bold py-2">Grand Total</td><td className="text-end fw-bold py-2 text-primary fs-6">{"\u20B9"} {formatCurrency(totals.grandTotal)}</td></tr>

              {totals.grandTotal > 0 && (() => {
                const prevBal = Number(vendor?.data?.balance || 0);
                const paid = Number(paidAmount) || 0;
                const newBal = prevBal + paid - totals.grandTotal;
                return (
                  <tr className="border-top">
                    <td className="py-1 small">
                      {newBal >= -0.01 ? <span className="text-success fw-medium">Advance</span> : <span className="text-danger fw-medium">Balance Due</span>}
                    </td>
                    <td className="text-end fw-bold small py-1">
                      <span className={newBal >= -0.01 ? "text-success" : "text-danger"}>
                        {"\u20B9"} {formatCurrency(Math.abs(newBal))}
                      </span>
                    </td>
                  </tr>
                );
              })()}
            </tbody></table>
          </div></div></div>
        </div>
      </form>

      {showAddVendor && (
        <>
          <div className="modal-backdrop fade show" onClick={() => setShowAddVendor(false)}></div>
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow">
                <div className="modal-header">
                  <h6 className="modal-title fw-semibold">
                    <i className="fa-solid fa-truck me-2 text-success"></i>Add New Vendor
                  </h6>
                  <button type="button" className="btn-close" onClick={() => setShowAddVendor(false)}></button>
                </div>
                <form onSubmit={handleAddVendor}>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-4">
                        <label className="form-label small fw-medium">Salutation</label>
                        <select className="form-select form-select-sm" value={vendorForm.salutation} onChange={(e) => setVendorForm({ ...vendorForm, salutation: e.target.value })}>
                          {SALUTATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="col-8">
                        <label className="form-label small fw-medium">Name *</label>
                        <input className="form-control form-control-sm" value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} required />
                      </div>
                      <div className="col-6">
                        <label className="form-label small fw-medium">Mobile *</label>
                        <PhoneInput className="input-group-sm" value={vendorForm.mobile} onChange={(e) => setVendorForm({ ...vendorForm, mobile: e.target.value })} required />
                      </div>
                      <div className="col-6">
                        <label className="form-label small fw-medium">Email</label>
                        <input type="email" className="form-control form-control-sm" value={vendorForm.email} onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })} />
                      </div>
                      <div className="col-12">
                        <label className="form-label small fw-medium">Address *</label>
                        <textarea className="form-control form-control-sm" rows={2} value={vendorForm.address} onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })} required />
                      </div>
                      <div className="col-12">
                        <label className="form-label small fw-medium">GSTIN</label>
                        <input className="form-control form-control-sm" value={vendorForm.gstin} onChange={(e) => setVendorForm({ ...vendorForm, gstin: e.target.value })} placeholder="Optional" />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowAddVendor(false)}>Cancel</button>
                    <button type="submit" className="btn btn-sm btn-success" disabled={savingVendor}>
                      {savingVendor ? <><span className="spinner-border spinner-border-sm me-1" />Saving\u2026</> : <><i className="fa-solid fa-check me-1"></i>Create & Select</>}
                    </button>
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
