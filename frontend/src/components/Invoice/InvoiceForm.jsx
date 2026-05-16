import { useState, useEffect, useCallback, useRef } from "react";
import Select from "react-select";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import PhoneInput from "../shared/PhoneInput";
import BarcodeScanner from "../shared/BarcodeScanner";
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

const EMPTY_CUSTOMER_FORM = {
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

function buildCustomerOption(customer) {
  return {
    value: customer.id,
    label: `${customer.code || `CUST-${customer.id}`} - ${customer.salutation || ""} ${customer.name}`.trim(),
    data: customer,
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

export default function InvoiceForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { company: authCompany } = useAuth();

  const quantityRefs = useRef({});
  const scanProcessingRef = useRef(false);

  const [invoiceCode, setInvoiceCode] = useState("");
  const [date, setDate] = useState(todayISO());
  const [term, setTerm] = useState(PAYMENT_TERMS[0]);
  const [customer, setCustomer] = useState(null);
  const [placeOfSupplyStateCode, setPlaceOfSupplyStateCode] = useState("");
  const [priceIncludesGst] = useState(true);
  const [isExport, setIsExport] = useState(false);
  const [discountType, setDiscountType] = useState("PERCENTAGE");
  const [discountInput, setDiscountInput] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([createInvoiceItemDraft()]);

  const [customerOptions, setCustomerOptions] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [customerEditMode, setCustomerEditMode] = useState(false);
  const [customerForm, setCustomerForm] = useState(EMPTY_CUSTOMER_FORM);
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const companyState = resolveCompanyState(authCompany);
  const selectedCustomer = customer?.data || null;
  const effectiveExport = Boolean(isExport) || (selectedCustomer && !isIndianCountry(selectedCustomer.country));
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
    isExport: effectiveExport,
    priceIncludesGst,
  });
  const displayItems = preview.items;
  const displayTotals = preview.totals;
  const selectedPlaceOfSupply = findStateByCode(placeOfSupplyStateCode);
  const customerBalance = Number(selectedCustomer?.balance || 0);
  const projectedBalance = customer
    ? customerBalance + (Number(paidAmount) || 0) - displayTotals.grandTotal
    : 0;

  const hasTax = displayTotals.totalTax > 0 || effectiveExport || displayItems.some((item) => Number(item.taxRate) > 0);

  const fetchOptions = useCallback(async () => {
    const [customerRes, productRes] = await Promise.all([
      api.get("/customers?pageSize=500&active=1"),
      api.get("/products?pageSize=500&active=1"),
    ]);

    const nextCustomerOptions = customerRes.data.data.map(buildCustomerOption);
    const nextProductOptions = productRes.data.data.map(buildProductOption);
    setCustomerOptions(nextCustomerOptions);
    setProductOptions(nextProductOptions);

    return { nextCustomerOptions, nextProductOptions };
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { nextCustomerOptions } = await fetchOptions();

        if (isEdit) {
          const res = await api.get(`/invoices/${id}`);
          const invoice = res.data.data;
          const customerData = {
            id: invoice.customer_id,
            code: invoice.customer_code,
            salutation: invoice.customer_salutation,
            name: invoice.customer_name,
            mobile: invoice.customer_mobile,
            email: invoice.customer_email,
            gstin: invoice.customer_gstin,
            country: invoice.customer_country || "India",
            state_name: invoice.customer_state_name || "",
            state_code: invoice.customer_state_code || "",
            billing_address: invoice.customer_billing_address || "",
            shipping_address: invoice.customer_shipping_address || "",
            balance: invoice.previous_balance || 0,
          };
          const existingCustomerOption = nextCustomerOptions.find((option) => option.value === invoice.customer_id);

          setInvoiceCode(invoice.code);
          setDate(invoice.date.split("T")[0]);
          setTerm(PAYMENT_TERMS.find((entry) => entry.value === invoice.term) || PAYMENT_TERMS[0]);
          setCustomer(existingCustomerOption || buildCustomerOption(customerData));
          setPlaceOfSupplyStateCode(invoice.place_of_supply_state_code || invoice.customer_state_code || "");
          setIsExport(Boolean(invoice.is_export));
          setDiscountType(invoice.discount_type || "PERCENTAGE");
          setDiscountInput(invoice.discount_input > 0 ? String(invoice.discount_input) : "");
          setPaidAmount(invoice.paid_amount > 0 ? String(invoice.paid_amount) : "");
          setNotes(invoice.notes || "");
          setItems(
            invoice.items.map((item) => ({
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
                invoice.price_includes_gst && item.total_value && item.quantity
                  ? round2(item.total_value / item.quantity)
                  : item.rate
              ),
              quantity: String(item.quantity),
              taxRate: Number(item.tax_rate || 0),
            }))
          );
        }
      } catch {
        toast.error(isEdit ? "Failed to load invoice." : "Failed to load data.");
        if (isEdit) {
          navigate("/invoices");
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [fetchOptions, id, isEdit, navigate]);

  useEffect(() => {
    if (selectedCustomer && !effectiveExport) {
      setPlaceOfSupplyStateCode(selectedCustomer.state_code || "");
    }
    if (selectedCustomer && !isIndianCountry(selectedCustomer.country || "India")) {
      setIsExport(true);
      setPlaceOfSupplyStateCode("");
    }
  }, [selectedCustomer, effectiveExport]);

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

  const handleScan = useCallback(async (barcodeValue) => {
    if (scanProcessingRef.current) return;

    scanProcessingRef.current = true;
    setScanResult({ code: barcodeValue, status: "searching" });

    try {
      const res = await api.get(`/products/barcode/${encodeURIComponent(barcodeValue)}`);
      const product = res.data.data;
      let targetKey = null;

      setItems((current) => {
        const existingIndex = current.findIndex((item) => item.product_id === product.id);
        if (existingIndex !== -1) {
          targetKey = current[existingIndex]._key;
          return current.map((item, index) =>
            index === existingIndex
              ? { ...item, quantity: String((Number(item.quantity) || 0) + 1) }
              : item
          );
        }

        const draft = createInvoiceItemDraft();
        targetKey = draft._key;
        return [
          ...current,
          {
            ...draft,
            product_id: product.id,
            product,
            rate: String(product.price),
            quantity: "1",
            taxRate: Number(product.tax_rate || 0),
          },
        ];
      });

      setScanResult({ code: barcodeValue, status: "found", productName: product.name });
      setTimeout(() => {
        if (targetKey && quantityRefs.current[targetKey]) {
          quantityRefs.current[targetKey].focus();
          quantityRefs.current[targetKey].select();
        }
      }, 100);
    } catch (error) {
      setScanResult({ code: barcodeValue, status: "not_found" });
      if (error?.response?.status === 404) {
        toast.error("No product found for this barcode");
      } else {
        toast.error("Scanner lookup failed. Please try again.");
      }
    } finally {
      scanProcessingRef.current = false;
    }
  }, []);

  function handleCustomerCountryChange(value) {
    if (isIndianCountry(value)) {
      setCustomerForm((current) => ({ ...current, country: "India" }));
      return;
    }

    setCustomerForm((current) => ({
      ...current,
      country: value,
      state_name: "",
      state_code: "",
    }));
  }

  function handleCustomerStateChange(stateCode) {
    const state = INDIAN_STATES.find((item) => item.code === stateCode);
    setCustomerForm((current) => ({
      ...current,
      state_code: state?.code || "",
      state_name: state?.name || "",
    }));
  }

  function handleCustomerGstinChange(value) {
    const nextValue = value.toUpperCase();
    const state = deriveStateFromGstin(nextValue);
    setCustomerForm((current) => ({
      ...current,
      gstin: nextValue,
      ...(state && isIndianCountry(current.country)
        ? { state_code: state.code, state_name: state.name }
        : {}),
    }));
  }

  async function handleSaveCustomer(event) {
    event.preventDefault();

    if (!customerForm.name || !customerForm.mobile || !customerForm.billing_address) {
      toast.error("Name, mobile, and billing address are required");
      return;
    }

    if (isIndianCountry(customerForm.country) && !customerForm.state_code) {
      toast.error("State is required for customers in India");
      return;
    }

    setSavingCustomer(true);
    try {
      const payload = {
        ...customerForm,
        address: customerForm.billing_address,
        shipping_address: customerForm.shipping_address || customerForm.billing_address,
      };

      let nextCustomer;
      if (customerEditMode && selectedCustomer?.id) {
        const res = await api.put(`/customers/${selectedCustomer.id}`, payload);
        nextCustomer = { ...selectedCustomer, ...payload };
        toast.success("Customer updated");
      } else {
        const res = await api.post("/customers", payload);
        nextCustomer = res.data.data;
        toast.success("Customer created");
      }

      const option = buildCustomerOption(nextCustomer);
      setCustomerOptions((current) => {
        const otherOptions = current.filter((opt) => opt.value !== nextCustomer.id);
        return [...otherOptions, option];
      });
      setCustomer(option);
      setShowAddCustomer(false);
      setCustomerForm(EMPTY_CUSTOMER_FORM);
      setCustomerEditMode(false);
    } catch (error) {
      let message = error.response?.data?.error || "Failed to save customer";
      if (error.response?.data?.details) {
        message = Object.values(error.response.data.details)
          .map((detail) => detail.msg)
          .join(", ");
      }
      toast.error(message);
    } finally {
      setSavingCustomer(false);
    }
  }

  function openEditCustomer() {
    if (!selectedCustomer) return;
    setCustomerForm({
      salutation: selectedCustomer.salutation || "Mr.",
      name: selectedCustomer.name || "",
      mobile: selectedCustomer.mobile || "",
      email: selectedCustomer.email || "",
      gstin: selectedCustomer.gstin || "",
      country: selectedCustomer.country || "India",
      state_name: selectedCustomer.state_name || "",
      state_code: selectedCustomer.state_code || "",
      billing_address: selectedCustomer.billing_address || selectedCustomer.address || "",
      shipping_address: selectedCustomer.shipping_address || "",
    });
    setCustomerEditMode(true);
    setShowAddCustomer(true);
  }

  function validate() {
    const nextErrors = {};

    if (!date) nextErrors.date = "Date is required";
    if (!customer) nextErrors.customer = "Customer is required";
    if (!term) nextErrors.term = "Payment term is required";

    if (!effectiveExport && !companyState.code) {
      nextErrors.company = "Your company GST state is missing. Update the company GSTIN first.";
    }

    if (!effectiveExport && !placeOfSupplyStateCode) {
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
      if (!item.quantity || Number(item.quantity) <= 0) {
        nextErrors[`item_${index}_quantity`] = "Enter a valid quantity";
      } else {
        const product = item.product || productOptions.find((o) => o.value === item.product_id)?.data;
        if (product && product.current_stock != null && Number(item.quantity) > Number(product.current_stock)) {
          nextErrors[`item_${index}_quantity`] = `Exceeds stock (${product.current_stock})`;
        }
      }
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
        customer_id: customer.value,
        place_of_supply_state_code: effectiveExport ? null : placeOfSupplyStateCode,
        place_of_supply_state_name: effectiveExport ? null : selectedPlaceOfSupply?.name || null,
        is_export: effectiveExport,
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
        await api.put(`/invoices/${id}`, payload);
        toast.success("Invoice updated successfully");
        navigate(`/invoices/${id}/view`);
      } else {
        const res = await api.post("/invoices", payload);
        toast.success("Invoice created successfully");
        navigate(`/invoices/${res.data.data.id}/view`);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to save invoice");
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
            <h5 className="mb-0 fw-semibold">
              <i className="fa-solid fa-file-invoice me-2 text-primary" />
              {isEdit ? "Edit Invoice" : "New Invoice"}
            </h5>
            {invoiceCode && <small className="text-muted">Code: <strong>{invoiceCode}</strong></small>}
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => navigate("/invoices")} disabled={submitting}>
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
                  {isEdit ? "Update Invoice" : "Save Invoice"}
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
                  <label className="form-label fw-medium small mb-0">Customer / Party *</label>
                  <div className="d-flex gap-1">
                    {selectedCustomer && (
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm py-0 px-2"
                        style={{ fontSize: "0.75rem", lineHeight: "1.6" }}
                        onClick={openEditCustomer}
                      >
                        <i className="fa-solid fa-pen-to-square" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-outline-success btn-sm py-0 px-2"
                      style={{ fontSize: "0.75rem", lineHeight: "1.6" }}
                      onClick={() => {
                        setCustomerEditMode(false);
                        setCustomerForm(EMPTY_CUSTOMER_FORM);
                        setShowAddCustomer(true);
                      }}
                    >
                      <i className="fa-solid fa-user-plus me-1" />
                      New
                    </button>
                  </div>
                </div>
                <Select
                  options={customerOptions}
                  value={customer}
                  onChange={setCustomer}
                  styles={selectStyles}
                  placeholder="Search customer..."
                  isClearable
                  filterOption={(option, input) =>
                    option.label.toLowerCase().includes(input.toLowerCase()) ||
                    (option.data?.mobile || "").includes(input)
                  }
                />
                {errors.customer && <div className="text-danger mt-1" style={{ fontSize: "0.75rem" }}>{errors.customer}</div>}
                {selectedCustomer && (
                  <small className="text-muted d-block mt-1">
                    {selectedCustomer.mobile}
                    {selectedCustomer.state_name ? ` • ${selectedCustomer.state_name}` : ""}
                    {selectedCustomer.country ? ` • ${selectedCustomer.country}` : ""}
                    {selectedCustomer.gstin ? ` • GSTIN: ${selectedCustomer.gstin}` : ""}
                  </small>
                )}
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label fw-medium small mb-1">Place of Supply</label>
                <select
                  className={`form-select form-select-sm ${errors.placeOfSupply ? "is-invalid" : ""}`}
                  value={placeOfSupplyStateCode}
                  onChange={(event) => setPlaceOfSupplyStateCode(event.target.value)}
                  disabled={effectiveExport}
                >
                  <option value="">{effectiveExport ? "Export supply" : "Select state"}</option>
                  {INDIAN_STATES.filter((state) => Number(state.code) < 90).map((state) => (
                    <option key={state.code} value={state.code}>
                      {state.name}
                    </option>
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

              <div className="col-6 col-md-4 d-flex flex-column justify-content-end">
                <div className="form-check mb-2">
                  <input
                    id="invoice-export-toggle"
                    className="form-check-input"
                    type="checkbox"
                    checked={effectiveExport}
                    disabled={selectedCustomer ? !isIndianCountry(selectedCustomer.country || "India") : false}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setIsExport(checked);
                      if (checked) {
                        setPlaceOfSupplyStateCode("");
                      } else {
                        setPlaceOfSupplyStateCode(selectedCustomer?.state_code || "");
                      }
                    }}
                  />
                  <label className="form-check-label small" htmlFor="invoice-export-toggle">
                    Mark as Export Invoice
                  </label>
                </div>
              </div>
            </div>

            {effectiveExport && (
              <div className="alert alert-info mt-3 mb-0 py-2 small">
                <strong>Export supply:</strong> this invoice will use IGST logic. If all item GST rates are `0%`, the print view will show the zero-rated export declaration note.
              </div>
            )}
          </div>
        </div>

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-header bg-white border-bottom py-2 d-flex justify-content-between align-items-center">
            <span className="fw-semibold small">
              <i className="fa-solid fa-list me-2 text-primary" />
              Products / Services
            </span>
            <div className="d-flex gap-2">
              <button
                type="button"
                className={`btn btn-sm ${showScanner ? "btn-danger" : "btn-outline-success"}`}
                onClick={() => setShowScanner((current) => !current)}
              >
                <i className={`fa-solid ${showScanner ? "fa-xmark" : "fa-barcode"} me-1`} />
                {showScanner ? "Close Scanner" : "Scan"}
              </button>
              <button type="button" className="btn btn-outline-primary btn-sm" onClick={addItem}>
                <i className="fa-solid fa-plus me-1" />
                Add Row
              </button>
            </div>
          </div>

          <div className="card-body p-0">
            <div className="table-responsive d-none d-xl-block">
              <table className="table table-sm align-middle mb-0 invoice-items-table">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: "34px" }} className="text-center">#</th>
                    <th style={{ minWidth: "220px" }}>Item</th>
                    <th style={{ width: "120px" }}>HSN/SAC (Optional)</th>
                    <th style={{ width: "90px" }} className="text-end">GST %</th>
                    <th style={{ width: "90px" }} className="text-end">Rate</th>
                    <th style={{ width: "90px" }} className="text-end">Qty</th>
                    <th style={{ width: "110px" }} className="text-end">Taxable</th>
                    <th style={{ width: "120px" }} className="text-end">CGST</th>
                    <th style={{ width: "120px" }} className="text-end">SGST</th>
                    <th style={{ width: "120px" }} className="text-end">IGST</th>
                    <th style={{ width: "115px" }} className="text-end">Total</th>
                    <th style={{ width: "42px" }} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const previewItem = displayItems[index];
                    const selectedProduct = item.product_id
                      ? productOptions.find((option) => option.value === item.product_id) || null
                      : null;

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
                              control: (base, state) => ({
                                ...selectStyles.control(base, state),
                                minHeight: "31px",
                                height: "31px",
                              }),
                            }}
                            placeholder="Search product..."
                            isClearable
                            filterOption={(option, input) => option.label.toLowerCase().includes(input.toLowerCase())}
                          />
                          {errors[`item_${index}_product`] ? (
                            <div className="text-danger mt-1" style={{ fontSize: "0.7rem" }}>{errors[`item_${index}_product`]}</div>
                          ) : selectedProduct?.data?.current_stock != null ? (
                            <div className={`mt-1 fw-medium ${Number(selectedProduct.data.current_stock) < Number(item.quantity) ? 'text-danger' : 'text-success'}`} style={{ fontSize: "0.7rem" }}>
                              Stock: {selectedProduct.data.current_stock}
                            </div>
                          ) : null}
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
                            className={`form-control form-control-sm text-end ${errors[`item_${index}_rate`] ? "is-invalid" : ""}`}
                            value={item.rate}
                            onChange={(event) => updateItem(item._key, { rate: event.target.value })}
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td>
                          <input
                            ref={(element) => { quantityRefs.current[item._key] = element; }}
                            type="number"
                            className={`form-control form-control-sm text-end ${errors[`item_${index}_quantity`] ? "is-invalid" : ""}`}
                            value={item.quantity}
                            onChange={(event) => updateItem(item._key, { quantity: event.target.value })}
                            min="0"
                            step="0.001"
                          />
                          {errors[`item_${index}_quantity`] && (
                            <div className="text-danger mt-1 text-end" style={{ fontSize: "0.7rem", whiteSpace: "nowrap" }}>
                              {errors[`item_${index}_quantity`]}
                            </div>
                          )}
                        </td>
                        <td className="text-end small">{formatCurrency(previewItem?.taxableValue)}</td>
                        <td className="text-end small">
                          {previewItem?.cgstRate ? `${formatTaxRate(previewItem.cgstRate)}% • ₹${formatCurrency(previewItem.cgstAmount)}` : "-"}
                        </td>
                        <td className="text-end small">
                          {previewItem?.sgstRate ? `${formatTaxRate(previewItem.sgstRate)}% • ₹${formatCurrency(previewItem.sgstAmount)}` : "-"}
                        </td>
                        <td className="text-end small">
                          {previewItem?.igstRate ? `${formatTaxRate(previewItem.igstRate)}% • ₹${formatCurrency(previewItem.igstAmount)}` : "-"}
                        </td>
                        <td className="text-end fw-semibold small">{formatCurrency(previewItem?.totalValue)}</td>
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
                const previewItem = displayItems[index];
                const selectedProduct = item.product_id
                  ? productOptions.find((option) => option.value === item.product_id) || null
                  : null;

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
                      {errors[`item_${index}_product`] ? (
                        <div className="text-danger mt-1" style={{ fontSize: "0.7rem" }}>{errors[`item_${index}_product`]}</div>
                      ) : selectedProduct?.data?.current_stock != null ? (
                        <div className={`mt-1 fw-medium ${Number(selectedProduct.data.current_stock) < Number(item.quantity) ? 'text-danger' : 'text-success'}`} style={{ fontSize: "0.7rem" }}>
                          Stock: {selectedProduct.data.current_stock}
                        </div>
                      ) : null}
                    </div>

                    <div className="row g-2 mb-3">
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

                    <div className="row g-2 mb-3">
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
                          ref={(element) => { quantityRefs.current[item._key] = element; }}
                          type="number"
                          className={`form-control form-control-sm text-end ${errors[`item_${index}_quantity`] ? "is-invalid" : ""}`}
                          value={item.quantity}
                          onChange={(event) => updateItem(item._key, { quantity: event.target.value })}
                          min="0"
                          step="0.001"
                        />
                        {errors[`item_${index}_quantity`] && (
                          <div className="text-danger mt-1 text-end" style={{ fontSize: "0.7rem" }}>
                            {errors[`item_${index}_quantity`]}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border rounded-3 bg-light px-2 py-1">
                      <div className="d-flex justify-content-between py-1 small">
                        <span className="text-muted">Taxable Value</span>
                        <span className="fw-medium">₹ {formatCurrency(previewItem?.taxableValue)}</span>
                      </div>
                      <div className="d-flex justify-content-between py-1 small border-top">
                        <span className="text-muted">CGST</span>
                        <span className="fw-medium">{previewItem?.cgstRate ? `${formatTaxRate(previewItem.cgstRate)}% • ₹${formatCurrency(previewItem.cgstAmount)}` : "-"}</span>
                      </div>
                      <div className="d-flex justify-content-between py-1 small border-top">
                        <span className="text-muted">SGST</span>
                        <span className="fw-medium">{previewItem?.sgstRate ? `${formatTaxRate(previewItem.sgstRate)}% • ₹${formatCurrency(previewItem.sgstAmount)}` : "-"}</span>
                      </div>
                      <div className="d-flex justify-content-between py-1 small border-top">
                        <span className="text-muted">IGST</span>
                        <span className="fw-medium">{previewItem?.igstRate ? `${formatTaxRate(previewItem.igstRate)}% • ₹${formatCurrency(previewItem.igstAmount)}` : "-"}</span>
                      </div>
                      <div className="d-flex justify-content-between py-1 small border-top">
                        <span className="text-muted">Total</span>
                        <span className="fw-semibold text-primary">₹ {formatCurrency(previewItem?.totalValue)}</span>
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
                  placeholder="Terms, payment instructions, export declaration notes, etc."
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
                      <td className="text-end fw-medium small py-1">₹ {formatCurrency(displayTotals.subTotal)}</td>
                    </tr>
                    <tr>
                      <td className="text-muted small py-1">Taxable Value</td>
                      <td className="text-end fw-medium small py-1">₹ {formatCurrency(displayTotals.taxableTotal)}</td>
                    </tr>
                    <tr>
                      <td className="text-muted small py-1">Total CGST</td>
                      <td className="text-end fw-medium small py-1">₹ {formatCurrency(displayTotals.totalCgst)}</td>
                    </tr>
                    <tr>
                      <td className="text-muted small py-1">Total SGST</td>
                      <td className="text-end fw-medium small py-1">₹ {formatCurrency(displayTotals.totalSgst)}</td>
                    </tr>
                    <tr>
                      <td className="text-muted small py-1">Total IGST</td>
                      <td className="text-end fw-medium small py-1">₹ {formatCurrency(displayTotals.totalIgst)}</td>
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
                            = ₹ {formatCurrency(discountAmount)}
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
                      <td className="text-end fw-bold py-2 text-primary fs-6">₹ {formatCurrency(displayTotals.grandTotal)}</td>
                    </tr>

                    {customer && (
                      <>
                        <tr>
                          <td className="text-muted small py-1">Previous Balance</td>
                          <td className="text-end fw-medium small py-1">
                            {customerBalance < 0 ? "Due" : customerBalance > 0 ? "Advance" : "Clear"}: ₹ {formatCurrency(Math.abs(customerBalance))}
                          </td>
                        </tr>
                        <tr>
                          <td className="text-muted small py-1">Net Payable</td>
                          <td className="text-end fw-medium small py-1">₹ {formatCurrency(displayTotals.grandTotal - customerBalance)}</td>
                        </tr>
                      </>
                    )}

                    <tr>
                      <td className="py-1">
                        <span className="text-muted small">Paid Amount (₹)</span>
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

                    {customer && (
                      <tr className="border-top">
                        <td className="fw-medium py-1">{projectedBalance >= -0.01 ? "Projected Advance / Clear" : "Projected Balance Due"}</td>
                        <td className={`text-end fw-bold small py-1 ${projectedBalance >= -0.01 ? "text-success" : "text-danger"}`}>
                          ₹ {formatCurrency(Math.abs(projectedBalance))}
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
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate("/invoices")} disabled={submitting}>
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
                {isEdit ? "Update Invoice" : "Save & View"}
              </>
            )}
          </button>
        </div>
      </form>

      {showAddCustomer && (
        <>
          <div className="modal-backdrop fade show" onClick={() => setShowAddCustomer(false)} />
          <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content border-0 shadow">
                <div className="modal-header">
                  <h6 className="modal-title fw-semibold">
                    <i className={`fa-solid ${customerEditMode ? "fa-user-pen text-primary" : "fa-user-plus text-success"} me-2`} />
                    {customerEditMode ? "Edit Customer" : "Add New Customer"}
                  </h6>
                  <button type="button" className="btn-close" onClick={() => setShowAddCustomer(false)} />
                </div>

                <form onSubmit={handleSaveCustomer}>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-4 col-md-2">
                        <label className="form-label small fw-medium">Salutation</label>
                        <select
                          className="form-select form-select-sm"
                          value={customerForm.salutation}
                          onChange={(event) => setCustomerForm({ ...customerForm, salutation: event.target.value })}
                        >
                          {SALUTATIONS.map((value) => (
                            <option key={value} value={value}>{value}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-8 col-md-5">
                        <label className="form-label small fw-medium">Name *</label>
                        <input
                          className="form-control form-control-sm"
                          value={customerForm.name}
                          onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })}
                          required
                        />
                      </div>
                      <div className="col-6 col-md-5">
                        <label className="form-label small fw-medium">Mobile *</label>
                        <PhoneInput
                          className="input-group-sm"
                          value={customerForm.mobile}
                          onChange={(event) => setCustomerForm({ ...customerForm, mobile: event.target.value })}
                          required
                        />
                      </div>
                      <div className="col-6 col-md-4">
                        <label className="form-label small fw-medium">Email</label>
                        <input
                          type="email"
                          className="form-control form-control-sm"
                          value={customerForm.email}
                          onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })}
                        />
                      </div>
                      <div className="col-6 col-md-4">
                        <label className="form-label small fw-medium">Country</label>
                        <input
                          className="form-control form-control-sm"
                          value={customerForm.country}
                          onChange={(event) => handleCustomerCountryChange(event.target.value)}
                        />
                      </div>
                      <div className="col-6 col-md-4">
                        <label className="form-label small fw-medium">GSTIN</label>
                        <input
                          className="form-control form-control-sm text-uppercase"
                          value={customerForm.gstin}
                          onChange={(event) => handleCustomerGstinChange(event.target.value)}
                          placeholder="Optional"
                        />
                      </div>
                      <div className="col-6 col-md-8">
                        <label className="form-label small fw-medium">State {isIndianCountry(customerForm.country) ? "*" : ""}</label>
                        <select
                          className="form-select form-select-sm"
                          value={customerForm.state_code}
                          onChange={(event) => handleCustomerStateChange(event.target.value)}
                          disabled={!isIndianCountry(customerForm.country)}
                        >
                          <option value="">Select state</option>
                          {INDIAN_STATES.filter((state) => Number(state.code) < 90).map((state) => (
                            <option key={state.code} value={state.code}>{state.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-6 col-md-4">
                        <label className="form-label small fw-medium">State Code</label>
                        <input className="form-control form-control-sm" value={customerForm.state_code} readOnly />
                      </div>
                      <div className="col-12">
                        <label className="form-label small fw-medium">Billing Address *</label>
                        <textarea
                          className="form-control form-control-sm"
                          rows={2}
                          value={customerForm.billing_address}
                          onChange={(event) => setCustomerForm({ ...customerForm, billing_address: event.target.value })}
                          required
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label small fw-medium">Shipping Address</label>
                        <textarea
                          className="form-control form-control-sm"
                          rows={2}
                          value={customerForm.shipping_address}
                          onChange={(event) => setCustomerForm({ ...customerForm, shipping_address: event.target.value })}
                          placeholder="Leave blank to reuse the billing address"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowAddCustomer(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-sm btn-success" disabled={savingCustomer}>
                      {savingCustomer ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-1" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-check me-1" />
                          {customerEditMode ? "Update" : "Create & Select"}
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

      {showScanner && (
        <BarcodeScanner
          show={showScanner}
          onClose={() => {
            setShowScanner(false);
            setScanResult(null);
          }}
          onScan={handleScan}
          lastResult={scanResult}
        />
      )}
    </div>
  );
}
