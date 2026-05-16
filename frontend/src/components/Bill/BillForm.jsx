import { useState, useEffect, useCallback } from "react";
import Select from "react-select";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import PhoneInput from "../shared/PhoneInput";
import api from "../../utils/api";
import { formatCurrency, round2, todayISO } from "../../utils/invoiceUtils";
import {
  GST_RATE_OPTIONS,
  INDIAN_STATES,
  calculateInvoicePreview,
  createInvoiceItemDraft,
  deriveStateFromGstin,
  findStateByCode,
  formatTaxRate,
  isIndianCountry,
} from "../../utils/gst";

const PAYMENT_TERMS = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "UPI", label: "UPI" },
  { value: "CREDIT", label: "Credit" },
];

const SALUTATIONS = ["Mr.", "Mrs.", "Ms.", "M/s.", "Dr."];

const EMPTY_VENDOR_FORM = {
  salutation: "M/s.",
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

function buildVendorOption(vendor) {
  return {
    value: vendor.id,
    label: `${vendor.code || `VEN-${vendor.id}`} - ${vendor.salutation || ""} ${vendor.name}`.trim(),
    data: vendor,
  };
}

function buildProductOption(product) {
  return {
    value: product.id,
    label: `${product.code} - ${product.name} (${product.unit})`,
    data: product,
  };
}

function resolveCompanyState(company) {
  const derivedState = deriveStateFromGstin(company?.gstin);
  return {
    code: company?.state_code || derivedState?.code || "",
    name: company?.state_name || derivedState?.name || "",
  };
}

export default function BillForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { company: authCompany } = useAuth();

  const [billCode, setBillCode] = useState("");
  const [date, setDate] = useState(todayISO());
  const [term, setTerm] = useState(PAYMENT_TERMS[0]);
  const [vendor, setVendor] = useState(null);
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState("");
  const [placeOfSupplyStateCode, setPlaceOfSupplyStateCode] = useState("");
  const [priceIncludesGst] = useState(true);
  const [isImport, setIsImport] = useState(false);
  const [discountType, setDiscountType] = useState("PERCENTAGE");
  const [discountInput, setDiscountInput] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([createInvoiceItemDraft()]);

  const [vendorOptions, setVendorOptions] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [showAddVendor, setShowAddVendor] = useState(false);
  const [vendorEditMode, setVendorEditMode] = useState(false);
  const [vendorForm, setVendorForm] = useState(EMPTY_VENDOR_FORM);
  const [savingVendor, setSavingVendor] = useState(false);

  const companyState = resolveCompanyState(authCompany);
  const selectedVendor = vendor?.data || null;
  const effectiveImport = Boolean(isImport) || (selectedVendor && !isIndianCountry(selectedVendor.country));
  const rawSubTotal = items.reduce((sum, item) => {
    const rate = round2(Number(item.rate) || 0);
    const qty = round2(Number(item.quantity) || 0);
    const taxRate = round2(Number(item.taxRate) || 0);
    if (priceIncludesGst && taxRate > 0) {
      const grossValue = round2(rate * qty);
      return sum + round2(grossValue / (1 + taxRate / 100));
    }
    return sum + round2(rate * qty);
  }, 0);
  const discountAmount = discountType === "PERCENTAGE"
    ? round2(rawSubTotal * (Number(discountInput) || 0) / 100)
    : round2(Number(discountInput) || 0);

  const preview = calculateInvoicePreview({
    items,
    discount: discountAmount,
    companyStateCode: companyState.code,
    placeOfSupplyStateCode,
    isExport: effectiveImport,
    priceIncludesGst,
    internationalSupplyType: "IMPORT",
  });
  const displayItems = preview.items;
  const displayTotals = preview.totals;
  const selectedPlaceOfSupply = findStateByCode(placeOfSupplyStateCode);
  const vendorBalance = Number(selectedVendor?.balance || 0);
  const projectedBalance = vendor
    ? vendorBalance + (Number(paidAmount) || 0) - displayTotals.grandTotal
    : 0;

  const fetchOptions = useCallback(async () => {
    const [vendorRes, productRes] = await Promise.all([
      api.get("/vendors?pageSize=500&active=1"),
      api.get("/products?pageSize=500&active=1"),
    ]);

    const nextVendorOptions = vendorRes.data.data.map(buildVendorOption);
    const nextProductOptions = productRes.data.data.map(buildProductOption);
    setVendorOptions(nextVendorOptions);
    setProductOptions(nextProductOptions);

    return { nextVendorOptions, nextProductOptions };
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { nextVendorOptions } = await fetchOptions();

        if (isEdit) {
          const res = await api.get(`/bills/${id}`);
          const bill = res.data.data;
          const vendorData = {
            id: bill.vendor_id,
            code: bill.vendor_code,
            salutation: bill.vendor_salutation,
            name: bill.vendor_name,
            mobile: bill.vendor_mobile,
            email: bill.vendor_email,
            gstin: bill.vendor_gstin,
            country: bill.vendor_country || "India",
            state_name: bill.vendor_state_name || "",
            state_code: bill.vendor_state_code || "",
            billing_address: bill.vendor_billing_address || "",
            shipping_address: bill.vendor_shipping_address || "",
            balance: bill.previous_balance || 0,
          };
          const existingVendorOption = nextVendorOptions.find((option) => option.value === bill.vendor_id);

          setBillCode(bill.code);
          setDate(bill.date.split("T")[0]);
          setTerm(PAYMENT_TERMS.find((entry) => entry.value === bill.term) || PAYMENT_TERMS[0]);
          setVendor(existingVendorOption || buildVendorOption(vendorData));
          setVendorInvoiceNumber(bill.vendor_invoice_number || "");
          setPlaceOfSupplyStateCode(bill.place_of_supply_state_code || bill.vendor_state_code || "");
          setIsImport(Boolean(bill.is_import));
          setDiscountType(bill.discount_type || "PERCENTAGE");
          setDiscountInput(bill.discount_input > 0 ? String(bill.discount_input) : "");
          setPaidAmount(bill.paid_amount > 0 ? String(bill.paid_amount) : "");
          setNotes(bill.notes || "");
          setItems(
            bill.items.map((item) => ({
              _key: `edit_${item.id}`,
              product_id: item.product_id,
              product: {
                id: item.product_id,
                name: item.product_name,
                code: item.product_code,
                unit: item.product_unit,
                hsn_sac_code: item.line_hsn_sac_code || item.hsn_sac_code || "",
              },
              hsn_sac_code: item.line_hsn_sac_code || item.hsn_sac_code || "",
              rate: String(
                bill.price_includes_gst && item.total_value && item.quantity
                  ? round2(item.total_value / item.quantity)
                  : item.rate
              ),
              quantity: String(item.quantity),
              taxRate: Number(item.tax_rate || 0),
            }))
          );
        }
      } catch {
        toast.error(isEdit ? "Failed to load bill." : "Failed to load data.");
        if (isEdit) {
          navigate("/bills");
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [fetchOptions, id, isEdit, navigate]);

  useEffect(() => {
    if (selectedVendor && !effectiveImport) {
      setPlaceOfSupplyStateCode(selectedVendor.state_code || "");
    }
    if (selectedVendor && !isIndianCountry(selectedVendor.country || "India")) {
      setIsImport(true);
      setPlaceOfSupplyStateCode("");
    }
  }, [selectedVendor, effectiveImport]);

  function updateItem(key, patch) {
    setItems((current) =>
      current.map((item) => {
        if (item._key !== key) return item;
        return { ...item, ...patch };
      })
    );
  }

  function selectProduct(key, option) {
    if (!option) {
      updateItem(key, { product_id: "", product: null, hsn_sac_code: "", rate: "", taxRate: 0 });
      return;
    }

    const product = option.data;
    updateItem(key, {
      product_id: product.id,
      product,
      hsn_sac_code: product.hsn_sac_code || "",
      rate: String(product.price),
      taxRate: Number(product.tax_rate || 0),
    });
  }

  function addItem() {
    setItems((current) => [...current, createInvoiceItemDraft()]);
  }

  function removeItem(key) {
    setItems((current) => {
      if (current.length === 1) return current;
      return current.filter((item) => item._key !== key);
    });
  }

  function handleVendorCountryChange(value) {
    if (isIndianCountry(value)) {
      setVendorForm((current) => ({ ...current, country: "India" }));
      return;
    }

    setVendorForm((current) => ({
      ...current,
      country: value,
      state_name: "",
      state_code: "",
    }));
  }

  function handleVendorStateChange(stateCode) {
    const state = INDIAN_STATES.find((item) => item.code === stateCode);
    setVendorForm((current) => ({
      ...current,
      state_code: state?.code || "",
      state_name: state?.name || "",
    }));
  }

  function handleVendorGstinChange(value) {
    const nextValue = value.toUpperCase();
    const state = deriveStateFromGstin(nextValue);
    setVendorForm((current) => ({
      ...current,
      gstin: nextValue,
      ...(state && isIndianCountry(current.country)
        ? { state_code: state.code, state_name: state.name }
        : {}),
    }));
  }

  async function handleSaveVendor(event) {
    event.preventDefault();

    if (!vendorForm.name || !vendorForm.mobile || !vendorForm.billing_address) {
      toast.error("Name, mobile, and billing address are required");
      return;
    }

    if (isIndianCountry(vendorForm.country) && !vendorForm.state_code) {
      toast.error("State is required for vendors in India");
      return;
    }

    setSavingVendor(true);
    try {
      const payload = {
        ...vendorForm,
        address: vendorForm.billing_address,
        shipping_address: vendorForm.shipping_address || vendorForm.billing_address,
      };

      let nextVendor;
      if (vendorEditMode && selectedVendor?.id) {
        const res = await api.put(`/vendors/${selectedVendor.id}`, payload);
        nextVendor = { ...selectedVendor, ...payload };
        toast.success("Vendor updated");
      } else {
        const res = await api.post("/vendors", payload);
        nextVendor = res.data.data;
        toast.success("Vendor created");
      }

      const option = buildVendorOption(nextVendor);
      setVendorOptions((current) => {
        const otherOptions = current.filter((opt) => opt.value !== nextVendor.id);
        return [...otherOptions, option];
      });
      setVendor(option);
      setShowAddVendor(false);
      setVendorForm(EMPTY_VENDOR_FORM);
      setVendorEditMode(false);
    } catch (error) {
      let message = error.response?.data?.error || "Failed to save vendor";
      if (error.response?.data?.details) {
        message = Object.values(error.response.data.details)
          .map((detail) => detail.msg)
          .join(", ");
      }
      toast.error(message);
    } finally {
      setSavingVendor(false);
    }
  }

  function openEditVendor() {
    if (!selectedVendor) return;
    setVendorForm({
      salutation: selectedVendor.salutation || "M/s.",
      name: selectedVendor.name || "",
      mobile: selectedVendor.mobile || "",
      email: selectedVendor.email || "",
      gstin: selectedVendor.gstin || "",
      country: selectedVendor.country || "India",
      state_name: selectedVendor.state_name || "",
      state_code: selectedVendor.state_code || "",
      billing_address: selectedVendor.billing_address || selectedVendor.address || "",
      shipping_address: selectedVendor.shipping_address || "",
    });
    setVendorEditMode(true);
    setShowAddVendor(true);
  }

  function validate() {
    const nextErrors = {};

    if (!date) nextErrors.date = "Date is required";
    if (!vendor) nextErrors.vendor = "Vendor is required";
    if (!term) nextErrors.term = "Payment term is required";
    if (!vendorInvoiceNumber) nextErrors.vendorInvoiceNumber = "Vendor invoice number is required";

    if (!effectiveImport && !companyState.code) {
      nextErrors.company = "Your company GST state is missing. Update the company GSTIN first.";
    }

    if (!effectiveImport && !placeOfSupplyStateCode) {
      nextErrors.placeOfSupply = "Place of supply is required";
    }

    if (discountInput !== "" && (Number(discountInput) < 0 || Number.isNaN(Number(discountInput)))) {
      nextErrors.discount = "Discount must be a non-negative number";
    }

    if (discountType === "PERCENTAGE" && Number(discountInput || 0) > 100) {
      nextErrors.discount = "Discount cannot exceed 100%";
    }

    if (displayTotals.grandTotal < 0) {
      nextErrors.discount = "Discount cannot exceed the total amount";
    }

    items.forEach((item, index) => {
      if (!item.product_id) nextErrors[`item_${index}_product`] = "Select a product";
      if (item.taxRate === "" || Number(item.taxRate) < 0) nextErrors[`item_${index}_tax`] = "Enter GST";
      if (!item.rate || Number(item.rate) <= 0) nextErrors[`item_${index}_rate`] = "Enter a valid rate";
      if (!item.quantity || Number(item.quantity) <= 0) nextErrors[`item_${index}_quantity`] = "Enter a valid quantity";
    });

    return nextErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix the highlighted fields before saving.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        date,
        term: term.value,
        vendor_id: vendor.value,
        vendor_invoice_number: vendorInvoiceNumber,
        place_of_supply_state_code: effectiveImport ? null : placeOfSupplyStateCode,
        place_of_supply_state_name: effectiveImport ? null : selectedPlaceOfSupply?.name || null,
        is_import: effectiveImport,
        price_includes_gst: true,
        discount: discountAmount,
        discount_type: discountType,
        discount_input: Number(discountInput) || 0,
        paid_amount: Number(paidAmount) || 0,
        notes: notes || null,
        items: items.map((item) => ({
          product_id: item.product_id,
          hsn_sac_code: item.hsn_sac_code,
          tax_rate: Number(item.taxRate) || 0,
          rate: Number(item.rate),
          quantity: Number(item.quantity),
        })),
      };

      if (isEdit) {
        await api.put(`/bills/${id}`, payload);
        toast.success("Bill updated successfully");
        navigate(`/bills/${id}/view`);
      } else {
        const res = await api.post("/bills", payload);
        toast.success("Bill created successfully");
        navigate(`/bills/${res.data.data.id}/view`);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to save bill");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "300px" }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="invoice-form-wrapper">
      <form onSubmit={handleSubmit} noValidate>
        <div className="d-flex flex-wrap align-items-center justify-content-between mb-3 gap-2">
          <div>
            <h5 className="mb-0 fw-semibold d-flex align-items-center gap-2">
              <i className="fa-solid fa-truck-ramp-box me-2 text-success" />
              {isEdit ? "Edit Purchase Bill" : "New Purchase Bill"}
              <span className="badge bg-success bg-opacity-10 text-success" style={{ fontSize: "0.65rem", letterSpacing: "0.06em" }}>PURCHASE</span>
            </h5>
            {billCode && <small className="text-muted">Code: <strong>{billCode}</strong></small>}
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => navigate("/bills")} disabled={submitting}>
              <i className="fa-solid fa-arrow-left me-1" />
              Back
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" />
                  Saving...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk me-1" />
                  {isEdit ? "Update Purchase Bill" : "Save Purchase Bill"}
                </>
              )}
            </button>
          </div>
        </div>

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-6 col-md-3">
                <label className="form-label fw-medium small mb-1">Date *</label>
                <input
                  type="date"
                  className={`form-control form-control-sm ${errors.date ? "is-invalid" : ""}`}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  max={todayISO()}
                />
                {errors.date && <div className="invalid-feedback">{errors.date}</div>}
              </div>

              <div className="col-6 col-md-3">
                <label className="form-label fw-medium small mb-1">Payment Term *</label>
                <Select options={PAYMENT_TERMS} value={term} onChange={setTerm} styles={selectStyles} />
              </div>

              <div className="col-12 col-md-6">
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <label className="form-label fw-medium small mb-0">Vendor / Supplier *</label>
                  <div className="d-flex gap-1">
                    {selectedVendor && (
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm py-0 px-2"
                        style={{ fontSize: "0.75rem", lineHeight: "1.6" }}
                        onClick={openEditVendor}
                      >
                        <i className="fa-solid fa-pen-to-square" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-outline-success btn-sm py-0 px-2"
                      style={{ fontSize: "0.75rem", lineHeight: "1.6" }}
                      onClick={() => {
                        setVendorEditMode(false);
                        setVendorForm(EMPTY_VENDOR_FORM);
                        setShowAddVendor(true);
                      }}
                    >
                      <i className="fa-solid fa-truck-fast me-1" />
                      New
                    </button>
                  </div>
                </div>
                <Select
                  options={vendorOptions}
                  value={vendor}
                  onChange={setVendor}
                  styles={selectStyles}
                  placeholder="Search vendor..."
                  isClearable
                />
                {errors.vendor && <div className="text-danger mt-1 small">{errors.vendor}</div>}
                {selectedVendor && (
                  <div className="mt-2 p-2 rounded border bg-light">
                    <small className="text-muted d-block">
                      <i className="fa-solid fa-truck-fast me-1 text-success" />
                      <strong>{selectedVendor.salutation || ""} {selectedVendor.name}</strong>
                    </small>
                    <small className="text-muted d-block mt-1" style={{ fontSize: "0.75rem" }}>
                      {selectedVendor.mobile && <span className="me-2"><i className="fa-solid fa-phone me-1" />{selectedVendor.mobile}</span>}
                      {selectedVendor.state_name && <span className="me-2"><i className="fa-solid fa-location-dot me-1" />{selectedVendor.state_name}{selectedVendor.country && selectedVendor.country !== "India" ? `, ${selectedVendor.country}` : ""}</span>}
                      {selectedVendor.gstin && <span><i className="fa-solid fa-building me-1" />GSTIN: {selectedVendor.gstin}</span>}
                    </small>
                  </div>
                )}
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label fw-medium small mb-1">Vendor Invoice # *</label>
                <input
                  className={`form-control form-control-sm ${errors.vendorInvoiceNumber ? "is-invalid" : ""}`}
                  value={vendorInvoiceNumber}
                  onChange={(event) => setVendorInvoiceNumber(event.target.value)}
                  placeholder="Supplier's invoice reference"
                />
                {errors.vendorInvoiceNumber && <div className="invalid-feedback">{errors.vendorInvoiceNumber}</div>}
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label fw-medium small mb-1">Place of Supply</label>
                <select
                  className={`form-select form-select-sm ${errors.placeOfSupply ? "is-invalid" : ""}`}
                  value={placeOfSupplyStateCode}
                  onChange={(event) => setPlaceOfSupplyStateCode(event.target.value)}
                  disabled={effectiveImport}
                >
                  <option value="">{effectiveImport ? "Not required for imports" : "Select state"}</option>
                  {INDIAN_STATES.filter((state) => Number(state.code) < 90).map((state) => (
                    <option key={state.code} value={state.code}>{state.name}</option>
                  ))}
                </select>
                {errors.placeOfSupply && <div className="invalid-feedback">{errors.placeOfSupply}</div>}
              </div>

              <div className="col-6 col-md-4">
                <label className="form-label fw-medium small mb-1">Company GST State</label>
                <input
                  className={`form-control form-control-sm ${errors.company ? "is-invalid" : ""}`}
                  value={companyState.name ? `${companyState.name} (${companyState.code})` : ""}
                  readOnly
                  placeholder="Update company GSTIN in Profile"
                />
                {errors.company && <div className="invalid-feedback">{errors.company}</div>}
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label fw-medium small mb-1">Supply Type</label>
                <div className="btn-group btn-group-sm w-100" role="group" aria-label="Purchase supply type">
                  <button
                    type="button"
                    className={`btn ${!effectiveImport ? "btn-primary" : "btn-outline-primary"}`}
                    onClick={() => {
                      setIsImport(false);
                      setPlaceOfSupplyStateCode(selectedVendor?.state_code || "");
                    }}
                    disabled={selectedVendor && !isIndianCountry(selectedVendor.country || "India")}
                  >
                    <i className="fa-solid fa-house-chimney me-1" />
                    Domestic
                  </button>
                  <button
                    type="button"
                    className={`btn ${effectiveImport ? "btn-primary" : "btn-outline-primary"}`}
                    onClick={() => {
                      setIsImport(true);
                      setPlaceOfSupplyStateCode("");
                    }}
                  >
                    <i className="fa-solid fa-globe me-1" />
                    Import
                  </button>
                </div>
                {selectedVendor && !isIndianCountry(selectedVendor.country || "India") && (
                  <div className="form-text small">Foreign vendors are treated as imports automatically.</div>
                )}
              </div>

            </div>

            {errors.company && (
              <div className="alert alert-warning mt-3 mb-0 py-2 small">
                {errors.company}
              </div>
            )}
            {effectiveImport && (
              <div className="alert alert-info mt-3 mb-0 py-2 small">
                <strong>Import purchase:</strong> place of supply is not required and the bill will use IGST/import tax treatment.
              </div>
            )}
          </div>
        </div>

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-header bg-white border-bottom py-2 d-flex justify-content-between align-items-center">
            <span className="fw-semibold small">
              <i className="fa-solid fa-boxes-stacked me-2 text-primary" />
              Products
            </span>
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={addItem}>
              <i className="fa-solid fa-plus me-1" />
              Add Row
            </button>
          </div>

          <div className="card-body p-0">
            <div className="table-responsive d-none d-xl-block">
              <table className="table table-sm align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="text-center" style={{ width: "36px" }}>#</th>
                    <th style={{ minWidth: "220px" }}>Product</th>
                    <th style={{ width: "110px" }}>Rate</th>
                    <th style={{ width: "120px" }}>HSN/SAC (Optional)</th>
                    <th style={{ width: "90px" }}>GST %</th>
                    <th style={{ width: "95px" }}>Qty</th>
                    <th style={{ width: "120px" }}>Taxable</th>
                    <th style={{ width: "120px" }}>CGST</th>
                    <th style={{ width: "120px" }}>SGST</th>
                    <th style={{ width: "120px" }}>IGST</th>
                    <th style={{ width: "120px" }}>Total</th>
                    <th style={{ width: "44px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const selectedProduct = item.product_id
                      ? productOptions.find((option) => option.value === item.product_id) || null
                      : null;
                    const previewItem = displayItems[index];

                    return (
                      <tr key={item._key}>
                        <td className="text-center text-muted small">{index + 1}</td>
                        <td>
                          <Select
                            options={productOptions}
                            value={selectedProduct}
                            onChange={(option) => selectProduct(item._key, option)}
                            menuPortalTarget={document.body}
                            styles={{
                              ...selectStyles,
                              menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                              control: (base, state) => ({ ...selectStyles.control(base, state), minHeight: "31px", height: "31px" }),
                            }}
                            placeholder="Search product..."
                            isClearable
                          />
                          {errors[`item_${index}_product`] && (
                            <div className="text-danger mt-1" style={{ fontSize: "0.7rem" }}>{errors[`item_${index}_product`]}</div>
                          )}
                          {selectedProduct?.data?.current_stock != null && (
                            <div className="mt-1 fw-medium text-muted" style={{ fontSize: "0.7rem" }}>
                              Stock: {selectedProduct.data.current_stock}
                            </div>
                          )}
                        </td>
                        <td>
                          <input
                            type="number"
                            className={`form-control form-control-sm text-end ${errors[`item_${index}_rate`] ? "is-invalid" : ""}`}
                            value={item.rate}
                            onChange={(event) => updateItem(item._key, { rate: event.target.value })}
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td>
                          <input
                            className={`form-control form-control-sm text-uppercase ${errors[`item_${index}_hsn`] ? "is-invalid" : ""}`}
                            value={item.hsn_sac_code || ""}
                            onChange={(event) => updateItem(item._key, { hsn_sac_code: event.target.value.toUpperCase() })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            list="gst-rate-suggestions"
                            className={`form-control form-control-sm text-end ${errors[`item_${index}_tax`] ? "is-invalid" : ""}`}
                            value={item.taxRate}
                            onChange={(event) => updateItem(item._key, { taxRate: event.target.value })}
                            min="0"
                            max="100"
                            step="0.001"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className={`form-control form-control-sm text-end ${errors[`item_${index}_quantity`] ? "is-invalid" : ""}`}
                            value={item.quantity}
                            onChange={(event) => updateItem(item._key, { quantity: event.target.value })}
                            min="0"
                            step="0.001"
                          />
                        </td>
                        <td className="text-end small">Rs. {formatCurrency(previewItem?.taxableValue)}</td>
                        <td className="text-end small">{previewItem?.cgstRate ? `${formatTaxRate(previewItem.cgstRate)}% / Rs.${formatCurrency(previewItem.cgstAmount)}` : "-"}</td>
                        <td className="text-end small">{previewItem?.sgstRate ? `${formatTaxRate(previewItem.sgstRate)}% / Rs.${formatCurrency(previewItem.sgstAmount)}` : "-"}</td>
                        <td className="text-end small">{previewItem?.igstRate ? `${formatTaxRate(previewItem.igstRate)}% / Rs.${formatCurrency(previewItem.igstAmount)}` : "-"}</td>
                        <td className="text-end fw-semibold small">Rs. {formatCurrency(previewItem?.totalValue)}</td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn btn-link btn-sm p-0 text-danger"
                            onClick={() => removeItem(item._key)}
                            disabled={items.length === 1}
                            style={{ opacity: items.length > 1 ? 1 : 0.3 }}
                          >
                            <i className="fa-solid fa-trash-can" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="d-xl-none p-2">
              {items.map((item, index) => {
                const selectedProduct = item.product_id
                  ? productOptions.find((option) => option.value === item.product_id) || null
                  : null;
                const previewItem = displayItems[index];

                return (
                  <div key={`mobile_${item._key}`} className="bg-white border rounded-3 shadow-sm p-3 mb-2">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <span className="small fw-semibold text-muted text-uppercase">Item {index + 1}</span>
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 text-danger"
                        onClick={() => removeItem(item._key)}
                        disabled={items.length === 1}
                        style={{ opacity: items.length > 1 ? 1 : 0.3 }}
                      >
                        <i className="fa-solid fa-trash-can" />
                      </button>
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-medium small mb-1">Product</label>
                      <Select
                        options={productOptions}
                        value={selectedProduct}
                        onChange={(option) => selectProduct(item._key, option)}
                        menuPortalTarget={document.body}
                        styles={{ ...selectStyles, menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                        placeholder="Search product..."
                        isClearable
                      />
                      {errors[`item_${index}_product`] && (
                        <div className="text-danger mt-1" style={{ fontSize: "0.7rem" }}>{errors[`item_${index}_product`]}</div>
                      )}
                      {selectedProduct?.data?.current_stock != null && (
                        <div className="mt-1 fw-medium text-muted" style={{ fontSize: "0.7rem" }}>
                          Stock: {selectedProduct.data.current_stock}
                        </div>
                      )}
                    </div>

                    <div className="row g-2 mb-2">
                      <div className="col-6">
                        <label className="form-label fw-medium small mb-1">HSN/SAC (Optional)</label>
                        <input
                          className={`form-control form-control-sm text-uppercase ${errors[`item_${index}_hsn`] ? "is-invalid" : ""}`}
                          value={item.hsn_sac_code || ""}
                          onChange={(event) => updateItem(item._key, { hsn_sac_code: event.target.value.toUpperCase() })}
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-medium small mb-1">GST %</label>
                        <input
                          type="number"
                          list="gst-rate-suggestions"
                          className={`form-control form-control-sm text-end ${errors[`item_${index}_tax`] ? "is-invalid" : ""}`}
                          value={item.taxRate}
                          onChange={(event) => updateItem(item._key, { taxRate: event.target.value })}
                          min="0"
                          max="100"
                          step="0.001"
                        />
                      </div>
                    </div>

                    <div className="row g-2 mb-2">
                      <div className="col-6">
                        <label className="form-label fw-medium small mb-1">Rate</label>
                        <input
                          type="number"
                          className={`form-control form-control-sm text-end ${errors[`item_${index}_rate`] ? "is-invalid" : ""}`}
                          value={item.rate}
                          onChange={(event) => updateItem(item._key, { rate: event.target.value })}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-medium small mb-1">Qty</label>
                        <input
                          type="number"
                          className={`form-control form-control-sm text-end ${errors[`item_${index}_quantity`] ? "is-invalid" : ""}`}
                          value={item.quantity}
                          onChange={(event) => updateItem(item._key, { quantity: event.target.value })}
                          min="0"
                          step="0.001"
                        />
                      </div>
                    </div>

                    <div className="border rounded-3 bg-light px-2 py-1">
                      <div className="d-flex justify-content-between py-1 small">
                        <span className="text-muted">Taxable Value</span>
                        <span className="fw-medium">Rs. {formatCurrency(previewItem?.taxableValue)}</span>
                      </div>
                      <div className="d-flex justify-content-between py-1 small border-top">
                        <span className="text-muted">CGST</span>
                        <span className="fw-medium">{previewItem?.cgstRate ? `${formatTaxRate(previewItem.cgstRate)}% / Rs.${formatCurrency(previewItem.cgstAmount)}` : "-"}</span>
                      </div>
                      <div className="d-flex justify-content-between py-1 small border-top">
                        <span className="text-muted">SGST</span>
                        <span className="fw-medium">{previewItem?.sgstRate ? `${formatTaxRate(previewItem.sgstRate)}% / Rs.${formatCurrency(previewItem.sgstAmount)}` : "-"}</span>
                      </div>
                      <div className="d-flex justify-content-between py-1 small border-top">
                        <span className="text-muted">IGST</span>
                        <span className="fw-medium">{previewItem?.igstRate ? `${formatTaxRate(previewItem.igstRate)}% / Rs.${formatCurrency(previewItem.igstAmount)}` : "-"}</span>
                      </div>
                      <div className="d-flex justify-content-between py-1 small border-top">
                        <span className="text-muted">Total</span>
                        <span className="fw-semibold text-primary">Rs. {formatCurrency(previewItem?.totalValue)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <datalist id="gst-rate-suggestions">
              {GST_RATE_OPTIONS.map((rate) => (
                <option key={rate} value={rate}>
                  {formatTaxRate(rate)}%
                </option>
              ))}
            </datalist>
          </div>

          <div className="card-footer bg-white border-top py-2">
            <button type="button" className="btn btn-link btn-sm text-primary p-0" onClick={addItem}>
              <i className="fa-solid fa-circle-plus me-1" />
              Add another product
            </button>
          </div>
        </div>

        <div className="row g-3 mb-4">
          <div className="col-12 col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <label className="form-label fw-medium small">Notes / Terms</label>
                <textarea
                  className="form-control form-control-sm"
                  rows={5}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Supplier notes, payment details, purchase remarks, etc."
                />
                {displayTotals.grandTotal > 0 && (
                  <div className="mt-3 p-2 rounded bg-light border">
                    <small className="text-muted d-block" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Amount in Words
                    </small>
                    <span className="fw-medium" style={{ fontSize: "0.8rem" }}>{displayTotals.amountInWords}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-6">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <table className="table table-sm table-borderless mb-0">
                  <tbody>
                    <tr>
                      <td className="text-muted small py-1">Sub Total (Before Discount)</td>
                      <td className="text-end fw-medium small py-1">Rs. {formatCurrency(displayTotals.subTotal)}</td>
                    </tr>
                    <tr>
                      <td className="text-muted small py-1">Taxable Value</td>
                      <td className="text-end fw-medium small py-1">Rs. {formatCurrency(displayTotals.taxableTotal)}</td>
                    </tr>
                    <tr>
                      <td className="text-muted small py-1">Total CGST</td>
                      <td className="text-end fw-medium small py-1">Rs. {formatCurrency(displayTotals.totalCgst)}</td>
                    </tr>
                    <tr>
                      <td className="text-muted small py-1">Total SGST</td>
                      <td className="text-end fw-medium small py-1">Rs. {formatCurrency(displayTotals.totalSgst)}</td>
                    </tr>
                    <tr>
                      <td className="text-muted small py-1">Total IGST</td>
                      <td className="text-end fw-medium small py-1">Rs. {formatCurrency(displayTotals.totalIgst)}</td>
                    </tr>
                    <tr>
                      <td className="py-1">
                        <div className="d-flex align-items-center gap-2">
                          <span className="text-muted small">Discount</span>
                          <div className="btn-group btn-group-sm" role="group" style={{ height: "24px" }}>
                            <button
                              type="button"
                              className={`btn btn-outline-primary py-0 px-2 ${discountType === "PERCENTAGE" ? "active" : ""}`}
                              onClick={() => setDiscountType("PERCENTAGE")}
                              style={{ fontSize: "0.65rem" }}
                            >
                              %
                            </button>
                            <button
                              type="button"
                              className={`btn btn-outline-primary py-0 px-2 ${discountType === "AMOUNT" ? "active" : ""}`}
                              onClick={() => setDiscountType("AMOUNT")}
                              style={{ fontSize: "0.65rem" }}
                            >
                              ₹
                            </button>
                          </div>
                        </div>
                        {discountAmount > 0 && discountType === "PERCENTAGE" && (
                          <div className="text-success small" style={{ fontSize: "0.75rem" }}>
                            = Rs. {formatCurrency(discountAmount)}
                          </div>
                        )}
                      </td>
                      <td className="text-end py-1">
                        <input
                          type="number"
                          className={`form-control form-control-sm text-end ${errors.discount ? "is-invalid" : ""}`}
                          value={discountInput}
                          onChange={(event) => setDiscountInput(event.target.value)}
                          min="0"
                          max={discountType === "PERCENTAGE" ? "100" : undefined}
                          step="0.01"
                          placeholder="0"
                          style={{ maxWidth: "100px", marginLeft: "auto" }}
                        />
                        {errors.discount && <div className="text-danger mt-1" style={{ fontSize: "0.7rem" }}>{errors.discount}</div>}
                      </td>
                    </tr>
                    <tr className="border-top">
                      <td className="fw-bold py-2">Grand Total</td>
                      <td className="text-end fw-bold py-2 text-primary fs-6">Rs. {formatCurrency(displayTotals.grandTotal)}</td>
                    </tr>

                    {vendor && (
                      <>
                        <tr>
                          <td className="text-muted small py-1">
                            Previous Balance
                            <div className="text-muted" style={{ fontSize: "0.7rem" }}>with Vendor</div>
                          </td>
                          <td className="text-end fw-medium small py-1">
                            {vendorBalance < 0 ? (
                              <span className="text-danger">Payable: Rs. {formatCurrency(Math.abs(vendorBalance))}</span>
                            ) : vendorBalance > 0 ? (
                              <span className="text-success">Vendor Credit: Rs. {formatCurrency(vendorBalance)}</span>
                            ) : (
                              <span>Clear</span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="text-muted small py-1">Net Payable to Vendor</td>
                          <td className="text-end fw-medium small py-1">Rs. {formatCurrency(displayTotals.grandTotal - vendorBalance)}</td>
                        </tr>
                      </>
                    )}

                    <tr>
                      <td className="py-1">
                        <span className="text-muted small">Paid Amount (Rs.)</span>
                      </td>
                      <td className="text-end py-1">
                        <input
                          type="number"
                          className="form-control form-control-sm text-end"
                          value={paidAmount}
                          onChange={(event) => setPaidAmount(event.target.value)}
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          style={{ maxWidth: "100px", marginLeft: "auto" }}
                        />
                      </td>
                    </tr>

                    {vendor && (
                      <tr className="border-top">
                        <td className="fw-medium py-1">
                          {projectedBalance >= -0.01 ? "Vendor Credit" : "Payable to Vendor"}
                          <div className="text-muted" style={{ fontSize: "0.7rem" }}>after this bill</div>
                        </td>
                        <td className={`text-end fw-bold small py-1 ${projectedBalance >= -0.01 ? "text-success" : "text-danger"}`}>
                          Rs. {formatCurrency(Math.abs(projectedBalance))}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2 justify-content-end mb-4">
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate("/bills")} disabled={submitting}>
            <i className="fa-solid fa-xmark me-1" />
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                Saving...
              </>
            ) : (
              <>
                <i className="fa-solid fa-floppy-disk me-1" />
                {isEdit ? "Update Purchase Bill" : "Save & View"}
              </>
            )}
          </button>
        </div>
      </form>

      {showAddVendor && (
        <>
          <div className="modal-backdrop fade show" onClick={() => setShowAddVendor(false)} />
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content border-0 shadow">
                <div className="modal-header">
                  <h6 className="modal-title fw-semibold">
                    <i className={`fa-solid ${vendorEditMode ? "fa-truck-field text-primary" : "fa-truck text-success"} me-2`} />
                    {vendorEditMode ? "Edit Vendor" : "Add New Vendor"}
                  </h6>
                  <button type="button" className="btn-close" onClick={() => setShowAddVendor(false)} />
                </div>

                <form onSubmit={handleSaveVendor}>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-4 col-md-2">
                        <label className="form-label small fw-medium">Salutation</label>
                        <select
                          className="form-select form-select-sm"
                          value={vendorForm.salutation}
                          onChange={(event) => setVendorForm({ ...vendorForm, salutation: event.target.value })}
                        >
                          {SALUTATIONS.map((value) => (
                            <option key={value} value={value}>{value}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-8 col-md-5">
                        <label className="form-label small fw-medium">Vendor Name *</label>
                        <input
                          className="form-control form-control-sm"
                          value={vendorForm.name}
                          onChange={(event) => setVendorForm({ ...vendorForm, name: event.target.value })}
                          required
                        />
                      </div>
                      <div className="col-6 col-md-5">
                        <label className="form-label small fw-medium">Mobile *</label>
                        <PhoneInput
                          className="input-group-sm"
                          value={vendorForm.mobile}
                          onChange={(event) => setVendorForm({ ...vendorForm, mobile: event.target.value })}
                          required
                        />
                      </div>
                      <div className="col-6 col-md-4">
                        <label className="form-label small fw-medium">Email</label>
                        <input
                          type="email"
                          className="form-control form-control-sm"
                          value={vendorForm.email}
                          onChange={(event) => setVendorForm({ ...vendorForm, email: event.target.value })}
                        />
                      </div>
                      <div className="col-6 col-md-4">
                        <label className="form-label small fw-medium">Country</label>
                        <input
                          className="form-control form-control-sm"
                          value={vendorForm.country}
                          onChange={(event) => handleVendorCountryChange(event.target.value)}
                        />
                      </div>
                      <div className="col-6 col-md-4">
                        <label className="form-label small fw-medium">GSTIN</label>
                        <input
                          className="form-control form-control-sm text-uppercase"
                          value={vendorForm.gstin}
                          onChange={(event) => handleVendorGstinChange(event.target.value)}
                          placeholder="Optional"
                        />
                      </div>
                      <div className="col-6 col-md-8">
                        <label className="form-label small fw-medium">State {isIndianCountry(vendorForm.country) ? "*" : ""}</label>
                        <select
                          className="form-select form-select-sm"
                          value={vendorForm.state_code}
                          onChange={(event) => handleVendorStateChange(event.target.value)}
                          disabled={!isIndianCountry(vendorForm.country)}
                        >
                          <option value="">Select state</option>
                          {INDIAN_STATES.filter((state) => Number(state.code) < 90).map((state) => (
                            <option key={state.code} value={state.code}>{state.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-6 col-md-4">
                        <label className="form-label small fw-medium">State Code</label>
                        <input className="form-control form-control-sm" value={vendorForm.state_code} readOnly />
                      </div>
                      <div className="col-12">
                        <label className="form-label small fw-medium">Billing Address *</label>
                        <textarea
                          className="form-control form-control-sm"
                          rows={2}
                          value={vendorForm.billing_address}
                          onChange={(event) => setVendorForm({ ...vendorForm, billing_address: event.target.value })}
                          required
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label small fw-medium">Shipping Address</label>
                        <textarea
                          className="form-control form-control-sm"
                          rows={2}
                          value={vendorForm.shipping_address}
                          onChange={(event) => setVendorForm({ ...vendorForm, shipping_address: event.target.value })}
                          placeholder="Leave blank to reuse the billing address"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowAddVendor(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-sm btn-success" disabled={savingVendor}>
                      {savingVendor ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-1" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-check me-1" />
                          {vendorEditMode ? "Update" : "Create & Select"}
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
    </div>
  );
}
