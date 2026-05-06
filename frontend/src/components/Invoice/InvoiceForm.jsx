
import { useState, useEffect, useCallback, useRef } from "react";
import Select from "react-select";
import { useNavigate, useParams } from "react-router-dom";
import {
  calcItemTotals,
  calcInvoiceTotals,
  newItemDraft,
  formatCurrency,
  todayISO,
} from "../../utils/invoiceUtils";
import api from "../../utils/api";
import { toast } from "react-toastify";
import PhoneInput from "../shared/PhoneInput";


const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: "38px",
    borderColor: state.isFocused ? "#0d6efd" : "#dee2e6",
    boxShadow: state.isFocused ? "0 0 0 0.2rem rgba(13,110,253,.25)" : "none",
    "&:hover": { borderColor: "#0d6efd" },
    borderRadius: "0.375rem",
    fontSize: "0.875rem",
  }),
  menu: (base) => ({ ...base, zIndex: 1050, fontSize: "0.875rem" }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? "#0d6efd" : state.isFocused ? "#e8f0fe" : "#fff",
    color: state.isSelected ? "#fff" : "#212529",
    padding: "6px 12px",
  }),
  placeholder: (base) => ({ ...base, color: "#6c757d" }),
  singleValue: (base) => ({ ...base, color: "#212529" }),
  indicatorSeparator: () => ({ display: "none" }),
};

const PAYMENT_TERMS = [
  { value: "CASH",   label: "Cash" },
  { value: "CARD",   label: "Card" },
  { value: "UPI",    label: "UPI" },
  { value: "CREDIT", label: "Credit" },
];


export default function InvoiceForm() {
  const navigate    = useNavigate();
  const { id }      = useParams();     
  const isEdit      = Boolean(id);
  const printRef    = useRef(null);

  
  const [invoiceCode,  setInvoiceCode]  = useState("");
  const [date,         setDate]         = useState(todayISO());
  const [term,         setTerm]         = useState({ value: "CASH", label: "Cash" });
  const [customer,     setCustomer]     = useState(null);
  const [discount,     setDiscount]     = useState("");
  const [paidAmount,   setPaidAmount]   = useState("");
  const [notes,        setNotes]        = useState("");

  
  const [items, setItems] = useState([newItemDraft()]);

  
  const [totals, setTotals] = useState({
    subTotal: 0, totalTax: 0, roundOff: 0, grandTotal: 0, amountInWords: "",
  });

  
  const [customerOptions, setCustomerOptions] = useState([]);
  const [productOptions,  setProductOptions]  = useState([]);

  
  const [loading,    setLoading]    = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [errors,     setErrors]     = useState({});

  const SALUTATIONS = ["Mr.", "Mrs.", "Ms.", "M/s.", "Dr."];
  const EMPTY_CUST_FORM = { salutation: "Mr.", name: "", mobile: "", address: "", email: "", gstin: "" };
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [custForm, setCustForm] = useState(EMPTY_CUST_FORM);
  const [savingCust, setSavingCust] = useState(false);

  
  const hasTax = items.some(i => (i.taxRate || 0) > 0);

  
  
  
  useEffect(() => {
    async function fetchOptions() {
      try {
        const [custRes, prodRes] = await Promise.all([
          api.get("/customers?pageSize=500&active=1"),
          api.get("/products?pageSize=500&active=1"),
        ]);

        setCustomerOptions(
          custRes.data.data.map(c => ({
            value: c.id,
            label: `${c.code} — ${c.salutation} ${c.name}`,
            data: c,
          }))
        );

        setProductOptions(
          prodRes.data.data.map(p => ({
            value: p.id,
            label: `${p.code} — ${p.name} (${p.unit})`,
            data: p,
          }))
        );
      } catch {
        toast.error("Failed to load data. Please refresh.");
      }
    }
    fetchOptions();
  }, []);

  
  
  
  useEffect(() => {
    if (!isEdit) return;

    async function fetchInvoice() {
      try {
        const res = await api.get(`/invoices/${id}`);
        const inv = res.data.data;

        setInvoiceCode(inv.code);
        setDate(inv.date.split("T")[0]);
        setTerm(PAYMENT_TERMS.find(t => t.value === inv.term) || PAYMENT_TERMS[0]);
        setCustomer({ value: inv.customer_id, label: `${inv.customer_code} — ${inv.customer_salutation} ${inv.customer_name}`, data: { ...inv, balance: inv.previous_balance } });
        setDiscount(inv.discount > 0 ? String(inv.discount) : "");
        setPaidAmount(inv.paid_amount > 0 ? String(inv.paid_amount) : "");
        setNotes(inv.notes || "");

        setItems(
          inv.items.map(item => ({
            _key:        `edit_${item.id}`,
            product_id:  item.product_id,
            product:     { id: item.product_id, name: item.product_name, code: item.product_code, unit: item.product_unit, tax_rate: item.tax_rate },
            rate:        String(item.rate),
            quantity:    String(item.quantity),
            value:       Number(item.value),
            taxRate:     Number(item.tax_rate),
            taxValue:    Number(item.tax_value),
            totalValue:  Number(item.total_value),
          }))
        );
      } catch {
        toast.error("Failed to load invoice.");
        navigate("/invoices");
      } finally {
        setLoading(false);
      }
    }
    fetchInvoice();
  }, [id, isEdit, navigate]);

  
  
  
  useEffect(() => {
    setTotals(calcInvoiceTotals(items, discount));
  }, [items, discount]);

  
  
  
  const updateItem = useCallback((key, patch) => {
    setItems(prev =>
      prev.map(item => {
        if (item._key !== key) return item;
        const updated = { ...item, ...patch };

        
        if ("rate" in patch || "quantity" in patch || "taxRate" in patch) {
          const { value, taxValue, totalValue } = calcItemTotals(
            "rate"     in patch ? patch.rate     : updated.rate,
            "quantity" in patch ? patch.quantity : updated.quantity,
            "taxRate"  in patch ? patch.taxRate  : updated.taxRate
          );
          return { ...updated, value, taxValue, totalValue };
        }
        return updated;
      })
    );
  }, []);

  const selectProduct = useCallback((key, option) => {
    if (!option) {
      updateItem(key, { product_id: "", product: null, rate: "", taxRate: 0, value: 0, taxValue: 0, totalValue: 0 });
      return;
    }
    const p = option.data;
    updateItem(key, {
      product_id: p.id,
      product:    p,
      rate:       String(p.price),
      taxRate:    Number(p.tax_rate),
    });
  }, [updateItem]);

  const addItem = useCallback(() => {
    setItems(prev => [...prev, newItemDraft()]);
  }, []);

  const removeItem = useCallback((key) => {
    setItems(prev => {
      if (prev.length === 1) return prev; 
      return prev.filter(i => i._key !== key);
    });
  }, []);

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!custForm.name || !custForm.mobile || !custForm.address) {
      toast.error("Name, mobile, and address are required");
      return;
    }
    setSavingCust(true);
    try {
      const res = await api.post("/customers", custForm);
      const c = res.data.data;
      const newOpt = {
        value: c.id,
        label: `${c.code} — ${c.salutation} ${c.name}`,
        data: c,
      };
      setCustomerOptions(prev => [...prev, newOpt]);
      setCustomer(newOpt);
      setShowAddCustomer(false);
      setCustForm(EMPTY_CUST_FORM);
      toast.success("Customer created & selected!");
    } catch (error) {
      let message = error.response?.data?.error || "Failed to create customer";
      if (error.response?.data?.details) {
        message = Object.values(error.response.data.details).map((d) => d.msg).join(", ");
      }
      toast.error(message);
    } finally {
      setSavingCust(false);
    }
  };

  
  
  
  function validate() {
    const errs = {};
    if (!date)                      errs.date     = "Date is required";
    if (!customer)                  errs.customer = "Customer is required";
    if (!term)                      errs.term     = "Payment term is required";

    const discountNum = Number(discount);
    if (discount !== "" && (isNaN(discountNum) || discountNum < 0))
      errs.discount = "Must be a non-negative number";
    if (discountNum > totals.subTotal)
      errs.discount = "Discount cannot exceed sub-total";

    items.forEach((item, idx) => {
      if (!item.product_id)       errs[`item_${idx}_product`]  = "Select a product";
      if (!item.rate || Number(item.rate) <= 0)
                                   errs[`item_${idx}_rate`]    = "Enter a valid rate";
      if (!item.quantity || Number(item.quantity) <= 0)
                                   errs[`item_${idx}_quantity`] = "Enter valid qty";
    });

    return errs;
  }

  
  
  
  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Please fix the errors before saving.");
      return;
    }

    setSubmitting(true);
    const payload = {
      date,
      term:        term.value,
      customer_id: customer.value,
      discount:    Number(discount) || 0,
      paid_amount: Number(paidAmount) || 0,
      notes:       notes || null,
      items: items.map(i => ({
        product_id: i.product_id,
        rate:       Number(i.rate),
        quantity:   Number(i.quantity),
      })),
    };

    try {
      if (isEdit) {
        await api.put(`/invoices/${id}`, payload);
        toast.success("Invoice updated successfully!");
      } else {
        const res = await api.post("/invoices", payload);
        toast.success("Invoice created successfully!");
        
        navigate(`/invoices/${res.data.data.id}/view`);
        return;
      }
      navigate("/invoices");
    } catch (err) {
      const msg = err.response?.data?.error || "Something went wrong. Try again.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  
  
  
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "300px" }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="invoice-form-wrapper">
      <form onSubmit={handleSubmit} noValidate>

        {}
        <div className="d-flex flex-wrap align-items-center justify-content-between mb-3 gap-2">
          <div>
            <h5 className="mb-0 fw-semibold">
              <i className="fa-solid fa-file-invoice me-2 text-primary"></i>
              {isEdit ? `Edit Invoice` : "New Invoice"}
            </h5>
            {invoiceCode && (
              <small className="text-muted">Code: <strong>{invoiceCode}</strong></small>
            )}
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => navigate("/invoices")}
              disabled={submitting}
            >
              <i className="fa-solid fa-arrow-left me-1"></i> Back
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={submitting}
            >
              {submitting ? (
                <><span className="spinner-border spinner-border-sm me-1" /> Saving…</>
              ) : (
                <><i className="fa-solid fa-floppy-disk me-1"></i> {isEdit ? "Update Invoice" : "Save Invoice"}</>
              )}
            </button>
          </div>
        </div>

        {}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="row g-3">

              {}
              <div className="col-6 col-md-3">
                <label className="form-label fw-medium small mb-1">
                  <i className="fa-regular fa-calendar me-1 text-muted"></i>Date <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  className={`form-control form-control-sm ${errors.date ? "is-invalid" : ""}`}
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  max={todayISO()}
                />
                {errors.date && <div className="invalid-feedback">{errors.date}</div>}
              </div>

              {}
              <div className="col-6 col-md-3">
                <label className="form-label fw-medium small mb-1">
                  <i className="fa-solid fa-money-bill-wave me-1 text-muted"></i>Term <span className="text-danger">*</span>
                </label>
                <Select
                  options={PAYMENT_TERMS}
                  value={term}
                  onChange={setTerm}
                  styles={selectStyles}
                  placeholder="Select term…"
                  className={errors.term ? "is-invalid-select" : ""}
                />
                {errors.term && <div className="text-danger" style={{ fontSize: "0.75rem" }}>{errors.term}</div>}
              </div>

              {}
              <div className="col-12 col-md-6">
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <label className="form-label fw-medium small mb-0">
                    <i className="fa-solid fa-user me-1 text-muted"></i>Customer <span className="text-danger">*</span>
                  </label>
                  <button
                    type="button"
                    className="btn btn-outline-success btn-sm py-0 px-2"
                    style={{ fontSize: "0.75rem", lineHeight: "1.6" }}
                    onClick={() => setShowAddCustomer(true)}
                    title="Add new customer"
                    id="add-customer-inline-btn"
                  >
                    <i className="fa-solid fa-user-plus me-1"></i>New
                  </button>
                </div>
                <Select
                  options={customerOptions}
                  value={customer}
                  onChange={setCustomer}
                  styles={selectStyles}
                  placeholder="Search customer…"
                  isClearable
                  filterOption={(option, input) =>
                    option.label.toLowerCase().includes(input.toLowerCase()) ||
                    (option.data?.mobile || "").includes(input)
                  }
                  noOptionsMessage={() => "No customers found"}
                  className={errors.customer ? "is-invalid-select" : ""}
                />
                {errors.customer && <div className="text-danger" style={{ fontSize: "0.75rem" }}>{errors.customer}</div>}
                {}
                {customer?.data && (
                  <small className="text-muted d-block mt-1">
                    <i className="fa-solid fa-phone fa-xs me-1"></i>{customer.data.mobile}
                    {customer.data.address && <> &nbsp;·&nbsp; <i className="fa-solid fa-location-dot fa-xs me-1"></i>{customer.data.address}</>}
                  </small>
                )}
              </div>

            </div>
          </div>
        </div>

        {}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-header bg-white border-bottom py-2 d-flex justify-content-between align-items-center">
            <span className="fw-semibold small">
              <i className="fa-solid fa-list me-2 text-primary"></i>Products / Services
            </span>
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={addItem}>
              <i className="fa-solid fa-plus me-1"></i> Add Row
            </button>
          </div>
          <div className="card-body p-0">

            {}
            <div className="table-responsive d-none d-md-block">
              <table className="table table-sm table-hover align-middle mb-0 invoice-items-table">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: "34px" }} className="text-center">#</th>
                    <th style={{ minWidth: "180px" }}>Product</th>
                    <th style={{ width: "100px" }}>Rate (₹)</th>
                    <th style={{ width: "90px" }}>Qty</th>
                    <th style={{ width: "110px" }}>Value (₹)</th>
                    {hasTax && <th style={{ width: "80px" }}>Tax %</th>}
                    {hasTax && <th style={{ width: "100px" }}>Tax (₹)</th>}
                    <th style={{ width: "115px" }}>Total (₹)</th>
                    <th style={{ width: "40px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <InvoiceItemRow
                      key={item._key}
                      item={item}
                      idx={idx}
                      hasTax={hasTax}
                      productOptions={productOptions}
                      errors={errors}
                      onProductChange={(opt) => selectProduct(item._key, opt)}
                      onFieldChange={(field, value) => updateItem(item._key, { [field]: value })}
                      onRemove={() => removeItem(item._key)}
                      canRemove={items.length > 1}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card layout */}
            <div className="d-md-none p-2">
              {items.map((item, idx) => {
                const selectedProduct = item.product_id
                  ? productOptions.find(o => o.value === item.product_id) || null
                  : null;
                return (
                  <div key={`mobile_${item._key}`} className="bg-white border rounded-3 shadow-sm p-3 mb-2">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <span className="small fw-semibold text-muted text-uppercase">Item {idx + 1}</span>
                      <button type="button" className="btn btn-link btn-sm p-0 text-danger" onClick={() => removeItem(item._key)} disabled={items.length === 1} style={{ opacity: items.length > 1 ? 1 : 0.3 }}>
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-medium small mb-1">Product</label>
                      <Select
                        options={productOptions}
                        value={selectedProduct}
                        onChange={(opt) => selectProduct(item._key, opt)}
                        menuPortalTarget={document.body}
                        styles={{ ...selectStyles, menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                        placeholder="Search product…"
                        isClearable
                        filterOption={(opt, input) => opt.label.toLowerCase().includes(input.toLowerCase())}
                        noOptionsMessage={() => "No products"}
                      />
                      {errors[`item_${idx}_product`] && (
                        <div className="text-danger mt-1" style={{ fontSize: "0.7rem" }}>{errors[`item_${idx}_product`]}</div>
                      )}
                      {item.product?.current_stock !== undefined && (
                        <small className={`d-block mt-1 ${item.product.current_stock < 5 ? "text-warning" : "text-muted"}`} style={{ fontSize: "0.68rem" }}>
                          <i className="fa-solid fa-boxes-stacked fa-xs me-1"></i>
                          Stock: {item.product.current_stock} {item.product?.unit}
                        </small>
                      )}
                    </div>

                    <div className="row g-2 mb-3">
                      <div className="col-6">
                        <label className="form-label fw-medium small mb-1">Rate (₹)</label>
                        <input
                          type="number"
                          className={`form-control form-control-sm text-end ${errors[`item_${idx}_rate`] ? "is-invalid" : ""}`}
                          value={item.rate}
                          onChange={e => updateItem(item._key, { rate: e.target.value })}
                          min="0" step="0.01" placeholder="0.00"
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-medium small mb-1">Qty</label>
                        <input
                          type="number"
                          className={`form-control form-control-sm text-end ${errors[`item_${idx}_quantity`] ? "is-invalid" : ""}`}
                          value={item.quantity}
                          onChange={e => updateItem(item._key, { quantity: e.target.value })}
                          min="0" step="0.001" placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="border rounded-3 bg-light px-2 py-1">
                      <div className="d-flex justify-content-between align-items-center py-1 small">
                        <span className="text-muted">Value</span>
                        <span className="fw-medium">{formatCurrency(item.value)}</span>
                      </div>
                      {hasTax && (
                        <div className="d-flex justify-content-between align-items-center py-1 small border-top">
                          <span className="text-muted">Tax %</span>
                          <span className="fw-medium">{item.taxRate > 0 ? `${item.taxRate}%` : "—"}</span>
                        </div>
                      )}
                      {hasTax && (
                        <div className="d-flex justify-content-between align-items-center py-1 small border-top">
                          <span className="text-muted">Tax</span>
                          <span className="fw-medium">{item.taxRate > 0 ? formatCurrency(item.taxValue) : "—"}</span>
                        </div>
                      )}
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

          {}
          <div className="card-footer bg-white border-top py-2">
            <button type="button" className="btn btn-link btn-sm text-primary p-0" onClick={addItem}>
              <i className="fa-solid fa-circle-plus me-1"></i> Add another product
            </button>
          </div>
        </div>

        {}
        <div className="row g-3 mb-4">

          {}
          <div className="col-12 col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <label className="form-label fw-medium small">
                  <i className="fa-solid fa-note-sticky me-1 text-muted"></i>Notes (optional)
                </label>
                <textarea
                  className="form-control form-control-sm"
                  rows={4}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Payment instructions, terms, etc."
                />
                {}
                {totals.grandTotal > 0 && (
                  <div className="mt-2 p-2 rounded bg-light border">
                    <small className="text-muted d-block" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Amount in Words</small>
                    <span className="fw-medium" style={{ fontSize: "0.8rem" }}>{totals.amountInWords}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {}
          <div className="col-12 col-md-6">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <table className="table table-sm table-borderless mb-0">
                  <tbody>
                    <tr>
                      <td className="text-muted small py-1">Sub Total</td>
                      <td className="text-end fw-medium small py-1">₹ {formatCurrency(totals.subTotal)}</td>
                    </tr>
                    {hasTax && (
                      <tr>
                        <td className="text-muted small py-1">Total Tax (GST)</td>
                        <td className="text-end fw-medium small py-1">₹ {formatCurrency(totals.totalTax)}</td>
                      </tr>
                    )}

                    {}
                    <tr>
                      <td className="py-1">
                        <div className="d-flex align-items-center gap-2">
                          <span className="text-muted small">Discount (₹)</span>
                        </div>
                      </td>
                      <td className="text-end py-1" style={{ width: "130px" }}>
                        <input
                          type="number"
                          className={`form-control form-control-sm text-end ${errors.discount ? "is-invalid" : ""}`}
                          value={discount}
                          onChange={e => setDiscount(e.target.value)}
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          style={{ maxWidth: "110px", marginLeft: "auto" }}
                        />
                        {errors.discount && (
                          <div className="text-danger mt-1" style={{ fontSize: "0.7rem" }}>{errors.discount}</div>
                        )}
                      </td>
                    </tr>

                    {}
                    {customer?.data?.balance !== undefined && Number(customer.data.balance) !== 0 && (
                      <tr>
                        <td className="py-1">
                          <span className="text-muted small">Previous Balance (₹)</span>
                        </td>
                        <td className="text-end fw-medium small py-1">
                          <span className={Number(customer.data.balance) < 0 ? "text-danger" : "text-success"}>
                            {Number(customer.data.balance) < 0 ? "Due: " : "Adv: "} ₹ {formatCurrency(Math.abs(Number(customer.data.balance)))}
                          </span>
                        </td>
                      </tr>
                    )}

                    {}
                    {customer?.data?.balance !== undefined && (
                      <tr className="border-top">
                        <td className="py-1 fw-medium small">Net Payable</td>
                        <td className="text-end fw-bold small py-1">
                          ₹ {formatCurrency(totals.grandTotal - Number(customer.data.balance || 0))}
                        </td>
                      </tr>
                    )}

                    {}
                    <tr>
                      <td className="py-1">
                        <div className="d-flex align-items-center gap-2">
                          <span className="text-muted small">Paid Amount (₹)</span>
                        </div>
                      </td>
                      <td className="text-end py-1" style={{ width: "130px" }}>
                        <input
                          type="number"
                          className="form-control form-control-sm text-end"
                          value={paidAmount}
                          onChange={e => setPaidAmount(e.target.value)}
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          style={{ maxWidth: "110px", marginLeft: "auto" }}
                        />
                      </td>
                    </tr>

                    {totals.roundOff !== 0 && (
                      <tr>
                        <td className="text-muted small py-1">Round Off</td>
                        <td className="text-end fw-medium small py-1">
                          {totals.roundOff > 0 ? "+" : ""}₹ {formatCurrency(totals.roundOff)}
                        </td>
                      </tr>
                    )}

                    <tr className="border-top">
                      <td className="fw-bold py-2">Grand Total</td>
                      <td className="text-end fw-bold py-2 text-primary fs-6">
                        ₹ {formatCurrency(totals.grandTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

        {}
        <div className="d-flex flex-wrap gap-2 justify-content-end mb-4">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => navigate("/invoices")}
            disabled={submitting}
          >
            <i className="fa-solid fa-xmark me-1"></i> Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? (
              <><span className="spinner-border spinner-border-sm me-2" />Saving…</>
            ) : (
              <><i className="fa-solid fa-floppy-disk me-1"></i>{isEdit ? "Update Invoice" : "Save & Print"}</>
            )}
          </button>
        </div>

      </form>

      {showAddCustomer && (
        <>
          <div className="modal-backdrop fade show" onClick={() => setShowAddCustomer(false)}></div>
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow">
                <div className="modal-header">
                  <h6 className="modal-title fw-semibold">
                    <i className="fa-solid fa-user-plus me-2 text-success"></i>Add New Customer
                  </h6>
                  <button type="button" className="btn-close" onClick={() => setShowAddCustomer(false)}></button>
                </div>
                <form onSubmit={handleAddCustomer}>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-4">
                        <label className="form-label small fw-medium">Salutation</label>
                        <select className="form-select form-select-sm" value={custForm.salutation} onChange={(e) => setCustForm({ ...custForm, salutation: e.target.value })}>
                          {SALUTATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="col-8">
                        <label className="form-label small fw-medium">Name *</label>
                        <input className="form-control form-control-sm" value={custForm.name} onChange={(e) => setCustForm({ ...custForm, name: e.target.value })} required />
                      </div>
                      <div className="col-6">
                        <label className="form-label small fw-medium">Mobile *</label>
                        <PhoneInput className="input-group-sm" value={custForm.mobile} onChange={(e) => setCustForm({ ...custForm, mobile: e.target.value })} required />
                      </div>
                      <div className="col-6">
                        <label className="form-label small fw-medium">Email</label>
                        <input type="email" className="form-control form-control-sm" value={custForm.email} onChange={(e) => setCustForm({ ...custForm, email: e.target.value })} />
                      </div>
                      <div className="col-12">
                        <label className="form-label small fw-medium">Address *</label>
                        <textarea className="form-control form-control-sm" rows={2} value={custForm.address} onChange={(e) => setCustForm({ ...custForm, address: e.target.value })} required />
                      </div>
                      <div className="col-12">
                        <label className="form-label small fw-medium">GSTIN</label>
                        <input className="form-control form-control-sm" value={custForm.gstin} onChange={(e) => setCustForm({ ...custForm, gstin: e.target.value })} placeholder="Optional" />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowAddCustomer(false)}>Cancel</button>
                    <button type="submit" className="btn btn-sm btn-success" disabled={savingCust}>
                      {savingCust ? <><span className="spinner-border spinner-border-sm me-1" />Saving…</> : <><i className="fa-solid fa-check me-1"></i>Create & Select</>}
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




function InvoiceItemRow({
  item, idx, hasTax, productOptions,
  errors, onProductChange, onFieldChange, onRemove, canRemove,
}) {
  const selectedProduct = item.product_id
    ? productOptions.find(o => o.value === item.product_id) || null
    : null;

  return (
    <tr>
      {}
      <td className="text-center text-muted small">{idx + 1}</td>

      {}
      <td>
        <Select
          options={productOptions}
          value={selectedProduct}
          onChange={onProductChange}
          menuPortalTarget={document.body}
          styles={{
            menuPortal: base => ({ ...base, zIndex: 9999 }),
            ...selectStyles,
            control: (base, state) => ({
              ...selectStyles.control(base, state),
              minHeight: "31px",
              height: "31px",
            }),
            valueContainer: (base) => ({ ...base, padding: "0 6px" }),
            indicatorsContainer: (base) => ({ ...base, height: "31px" }),
          }}
          placeholder="Search product…"
          isClearable
          filterOption={(opt, input) =>
            opt.label.toLowerCase().includes(input.toLowerCase())
          }
          noOptionsMessage={() => "No products"}
        />
        {errors[`item_${idx}_product`] && (
          <div className="text-danger mt-1" style={{ fontSize: "0.7rem" }}>
            {errors[`item_${idx}_product`]}
          </div>
        )}
        {}
        {item.product?.current_stock !== undefined && (
          <small className={`d-block mt-1 ${item.product.current_stock < 5 ? "text-warning" : "text-muted"}`} style={{ fontSize: "0.68rem" }}>
            <i className="fa-solid fa-boxes-stacked fa-xs me-1"></i>
            Stock: {item.product.current_stock} {item.product?.unit}
          </small>
        )}
      </td>

      {}
      <td>
        <input
          type="number"
          className={`form-control form-control-sm text-end ${errors[`item_${idx}_rate`] ? "is-invalid" : ""}`}
          value={item.rate}
          onChange={e => onFieldChange("rate", e.target.value)}
          min="0"
          step="0.01"
          placeholder="0.00"
        />
        {errors[`item_${idx}_rate`] && (
          <div className="invalid-feedback" style={{ fontSize: "0.7rem" }}>{errors[`item_${idx}_rate`]}</div>
        )}
      </td>

      {}
      <td>
        <input
          type="number"
          className={`form-control form-control-sm text-end ${errors[`item_${idx}_quantity`] ? "is-invalid" : ""}`}
          value={item.quantity}
          onChange={e => onFieldChange("quantity", e.target.value)}
          min="0"
          step="0.001"
          placeholder="0"
        />
        {errors[`item_${idx}_quantity`] && (
          <div className="invalid-feedback" style={{ fontSize: "0.7rem" }}>{errors[`item_${idx}_quantity`]}</div>
        )}
      </td>

      {}
      <td className="text-end small">{formatCurrency(item.value)}</td>

      {}
      {hasTax && (
        <td className="text-center small text-muted">
          {item.taxRate > 0 ? `${item.taxRate}%` : "—"}
        </td>
      )}

      {}
      {hasTax && (
        <td className="text-end small">{item.taxRate > 0 ? formatCurrency(item.taxValue) : "—"}</td>
      )}

      {}
      <td className="text-end fw-semibold small">{formatCurrency(item.totalValue)}</td>

      {}
      <td className="text-center">
        <button
          type="button"
          className="btn btn-link btn-sm p-0 text-danger"
          onClick={onRemove}
          disabled={!canRemove}
          title="Remove row"
          style={{ opacity: canRemove ? 1 : 0.3 }}
        >
          <i className="fa-solid fa-trash-can"></i>
        </button>
      </td>
    </tr>
  );
}
