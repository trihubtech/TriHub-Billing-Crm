import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import api from "../../utils/api";
import AuthImage from "../shared/AuthImage";
import { formatCurrency, formatDate, numberToWords, round2 } from "../../utils/invoiceUtils";
import { formatTaxRate } from "../../utils/gst";

const SIZES = {
  A3: { label: "A3", cssClass: "page-a3", widthMm: 297, heightMm: 420 },
  A4: { label: "A4", cssClass: "page-a4", widthMm: 210, heightMm: 297 },
  A5: { label: "A5", cssClass: "page-a5", widthMm: 148, heightMm: 210 },
  THERMAL: { label: "Receipt", cssClass: "page-thermal", widthMm: 80, heightMm: 220, isReceipt: true },
};

function clampPaperValue(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function buildBillSnapshot(bill) {
  const items = Array.isArray(bill?.items) ? bill.items : [];
  const taxableTotal = round2(
    Number(bill?.taxable_total) ||
    items.reduce((sum, item) => sum + Number(item.taxable_value ?? item.value ?? 0), 0)
  );
  const totalCgst = round2(
    Number(bill?.total_cgst) ||
    items.reduce((sum, item) => sum + Number(item.cgst_amount ?? 0), 0)
  );
  const totalSgst = round2(
    Number(bill?.total_sgst) ||
    items.reduce((sum, item) => sum + Number(item.sgst_amount ?? 0), 0)
  );
  const totalIgst = round2(
    Number(bill?.total_igst) ||
    items.reduce((sum, item) => sum + Number(item.igst_amount ?? 0), 0)
  );
  const totalTax = round2(Number(bill?.total_tax) || totalCgst + totalSgst + totalIgst);
  const subTotal = round2(
    Number(bill?.sub_total) ||
    items.reduce((sum, item) => sum + Number(item.base_value ?? item.value ?? 0), 0)
  );
  const discount = round2(Number(bill?.discount) || 0);
  const grandTotal = round2(Number(bill?.grand_total) || taxableTotal + totalTax);
  const paidAmount = round2(Number(bill?.paid_amount) || 0);
  const previousBalance = round2(Number(bill?.previous_balance) || 0);
  const balance = round2(Number(bill?.balance) || previousBalance + paidAmount - grandTotal);

  return {
    subTotal,
    discount,
    taxableTotal,
    totalCgst,
    totalSgst,
    totalIgst,
    totalTax,
    grandTotal,
    paidAmount,
    previousBalance,
    balance,
    amountInWords: bill?.amount_in_words?.trim() || numberToWords(grandTotal),
  };
}

export default function BillPrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const printRef = useRef(null);
  const { company: authCompany } = useAuth();

  const [bill, setBill] = useState(null);
  const [company, setCompany] = useState(authCompany || null);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState("A4");
  const [receiptWidthMm, setReceiptWidthMm] = useState(SIZES.THERMAL.widthMm);
  const [receiptHeightMm, setReceiptHeightMm] = useState(SIZES.THERMAL.heightMm);

  useEffect(() => {
    if (authCompany) {
      setCompany((current) => (current ? { ...current, ...authCompany } : authCompany));
    }
  }, [authCompany]);

  useEffect(() => {
    async function load() {
      try {
        const [billRes, companyRes] = await Promise.all([
          api.get(`/bills/${id}`),
          api.get("/profile/company").catch(() => ({ data: { data: authCompany || null } })),
        ]);
        setBill(billRes.data.data);
        setCompany(companyRes.data.data || authCompany || null);
      } catch {
        toast.error("Failed to load bill.");
        navigate("/bills");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [authCompany, id, navigate]);

  const selectedSize = SIZES[size];
  const paperWidthMm = selectedSize.isReceipt
    ? clampPaperValue(receiptWidthMm, SIZES.THERMAL.widthMm, 48, 120)
    : selectedSize.widthMm;
  const paperHeightMm = selectedSize.isReceipt
    ? clampPaperValue(receiptHeightMm, SIZES.THERMAL.heightMm, 60, 1000)
    : selectedSize.heightMm;
  const paperStyle = {
    width: `${paperWidthMm}mm`,
    minHeight: `${paperHeightMm}mm`,
  };

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "300px" }}>
        <div className="spinner-border text-primary" />
      </div>
    );
  }

  if (!bill) return null;

  const totals = buildBillSnapshot(bill);
  const isImport = Boolean(bill.is_import) || bill.supply_type === "IMPORT";

  return (
    <div className="invoice-print-wrapper">
      <div className="print-toolbar d-print-none">
        <div className="container-fluid">
          <div className="d-flex flex-wrap align-items-center gap-2 py-2">
            <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate("/bills")}>
              <i className="fa-solid fa-arrow-left me-1" />
              Bills
            </button>
            <button className="btn btn-outline-primary btn-sm" onClick={() => navigate(`/bills/${id}/edit`)}>
              <i className="fa-solid fa-pen-to-square me-1" />
              Edit
            </button>

            <div className="vr d-none d-md-block" />

            <div className="d-flex gap-1">
              {Object.entries(SIZES).map(([key, value]) => (
                <button
                  key={key}
                  className={`btn btn-sm ${size === key ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setSize(key)}
                >
                  {value.label}
                </button>
              ))}
            </div>

            {selectedSize.isReceipt && (
              <div className="receipt-size-controls">
                <span className="small text-muted">Receipt (mm)</span>
                <input
                  type="number"
                  min="48"
                  max="120"
                  step="1"
                  className="form-control form-control-sm"
                  value={receiptWidthMm}
                  onChange={(event) => setReceiptWidthMm(event.target.value)}
                />
                <span className="small text-muted">x</span>
                <input
                  type="number"
                  min="60"
                  max="1000"
                  step="1"
                  className="form-control form-control-sm"
                  value={receiptHeightMm}
                  onChange={(event) => setReceiptHeightMm(event.target.value)}
                />
              </div>
            )}

            <div className="ms-auto d-flex gap-2">
              <button className="btn btn-outline-dark btn-sm" onClick={handlePrint}>
                <i className="fa-solid fa-file-pdf me-1 text-danger" />
                PDF
              </button>
              <button className="btn btn-primary btn-sm" onClick={handlePrint}>
                <i className="fa-solid fa-print me-1" />
                Print
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`invoice-paper ${selectedSize.cssClass}`} style={paperStyle} ref={printRef} id="bill-print-area">
        <div className="inv-header">
          <div className="inv-header-left">
            {company?.logo ? (
              <AuthImage src={company.logo} alt="Company Logo" className="inv-logo" />
            ) : (
              <div className="inv-logo-placeholder">{(company?.name || "C").charAt(0)}</div>
            )}
            <div>
              <div className="inv-company-name">{company?.name || "Your Company"}</div>
              {company?.address && <div className="inv-company-meta">{company.address}</div>}
              {company?.phone && <div className="inv-company-meta">Phone: {company.phone}</div>}
              {company?.email && <div className="inv-company-meta">Email: {company.email}</div>}
              {company?.gstin && <div className="inv-company-meta">GSTIN: {company.gstin}</div>}
            </div>
          </div>

          <div className="inv-header-right">
            <div className="inv-title purchase-title">PURCHASE BILL</div>
            <table className="inv-meta-table">
              <tbody>
                <tr>
                  <td>Bill No.</td>
                  <td><strong>{bill.code}</strong></td>
                </tr>
                <tr>
                  <td>Vendor Ref</td>
                  <td><strong>{bill.vendor_invoice_number}</strong></td>
                </tr>
                <tr>
                  <td>Date</td>
                  <td>{formatDate(bill.date)}</td>
                </tr>
                <tr>
                  <td>Place of Supply</td>
                  <td>{bill.place_of_supply_state_name || bill.place_of_supply_country || "-"}</td>
                </tr>
                <tr>
                  <td>Supply Type</td>
                  <td>{(bill.supply_type || "INTRA_STATE").replace(/_/g, " ")}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="inv-panel-grid">
          <div className="inv-panel">
            <div className="inv-panel-title">Supplier</div>
            <div className="inv-party-name">{bill.vendor_salutation} {bill.vendor_name}</div>
            {bill.vendor_billing_address && <div className="inv-panel-text">{bill.vendor_billing_address}</div>}
            {bill.vendor_mobile && <div className="inv-panel-text">Phone: {bill.vendor_mobile}</div>}
            {bill.vendor_gstin && <div className="inv-panel-text">GSTIN: {bill.vendor_gstin}</div>}
          </div>

          <div className="inv-panel">
            <div className="inv-panel-title">Ship / Delivery Address</div>
            <div className="inv-panel-text">{bill.vendor_shipping_address || bill.vendor_billing_address || "-"}</div>
            <div className="inv-panel-text">
              {bill.vendor_state_name || "-"}
              {bill.vendor_country ? `, ${bill.vendor_country}` : ""}
            </div>
          </div>
        </div>

        <div className="inv-table-wrapper">
          <table className="inv-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>HSN</th>
                <th className="text-end">Qty</th>
                <th className="text-end">Rate (Incl. GST)</th>
                <th className="text-end">Taxable Value</th>
                <th className="text-end">CGST</th>
                <th className="text-end">SGST</th>
                <th className="text-end">IGST</th>
                <th className="text-end">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {bill.items.map((item, index) => (
                <tr key={item.id || `${item.product_id}_${index}`}>
                  <td>{index + 1}</td>
                  <td>
                    <div className="inv-product-name">{item.product_name}</div>
                    {item.product_code && <div className="inv-product-code">{item.product_code}</div>}
                  </td>
                  <td>{item.line_hsn_sac_code || item.hsn_sac_code || "-"}</td>
                  <td className="text-end">{item.quantity}</td>
                  <td className="text-end">
                    {formatCurrency(
                      bill.price_includes_gst && item.total_value && item.quantity
                        ? round2(item.total_value / item.quantity)
                        : item.rate
                    )}
                  </td>
                  <td className="text-end">{formatCurrency(item.taxable_value ?? item.value)}</td>
                  <td className="text-end">
                    {Number(item.cgst_rate) > 0 ? (
                      <>
                        <div className="inv-tax-amt">Rs. {formatCurrency(item.cgst_amount)}</div>
                        <div className="inv-tax-rate">@ {formatTaxRate(item.cgst_rate)}%</div>
                      </>
                    ) : "-"}
                  </td>
                  <td className="text-end">
                    {Number(item.sgst_rate) > 0 ? (
                      <>
                        <div className="inv-tax-amt">Rs. {formatCurrency(item.sgst_amount)}</div>
                        <div className="inv-tax-rate">@ {formatTaxRate(item.sgst_rate)}%</div>
                      </>
                    ) : "-"}
                  </td>
                  <td className="text-end">
                    {Number(item.igst_rate) > 0 ? (
                      <>
                        <div className="inv-tax-amt">Rs. {formatCurrency(item.igst_amount)}</div>
                        <div className="inv-tax-rate">@ {formatTaxRate(item.igst_rate)}%</div>
                      </>
                    ) : "-"}
                  </td>
                  <td className="text-end fw-semibold">{formatCurrency(item.total_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Receipt layout for thermal */}
        <div className="inv-receipt-items">
          {bill.items.map((item, index) => (
            <div key={item.id || `${item.product_id}_${index}`} className="inv-receipt-item">
              <div className="inv-receipt-row">
                <span className="inv-receipt-name">{index + 1}. {item.product_name}</span>
                <span className="inv-receipt-total">Rs. {formatCurrency(item.total_value)}</span>
              </div>
              <div className="inv-receipt-row inv-receipt-meta">
                <span>Qty: {item.quantity} × Rs. {formatCurrency(
                  bill.price_includes_gst && item.total_value && item.quantity
                    ? round2(item.total_value / item.quantity)
                    : item.rate
                )}</span>
                <span>Tax: Rs. {formatCurrency((item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0))}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="inv-footer-grid">
          <div className="inv-footer-left">
            <div className="inv-note-block">
              <div className="inv-panel-title">Amount in Words</div>
              <div className="inv-panel-text fw-medium">{totals.amountInWords}</div>
            </div>

            <div className="inv-note-block">
              <div className="inv-panel-title">Notes</div>
              <div className="inv-panel-text">{bill.notes || "Purchase record generated from CRM."}</div>
            </div>

            {isImport && (
              <div className="inv-note-block">
                <div className="inv-panel-title">Import Note</div>
                <div className="inv-panel-text">Input tax has been recorded under import / IGST treatment for this bill.</div>
              </div>
            )}
          </div>

          <div className="inv-summary">
            <div className="inv-summary-row">
              <span>Sub Total</span>
              <span>Rs. {formatCurrency(totals.subTotal)}</span>
            </div>
            <div className="inv-summary-row">
              <span>Total Taxable Value</span>
              <span>Rs. {formatCurrency(totals.taxableTotal)}</span>
            </div>
            <div className="inv-summary-row">
              <span>Total CGST</span>
              <span>Rs. {formatCurrency(totals.totalCgst)}</span>
            </div>
            <div className="inv-summary-row">
              <span>Total SGST</span>
              <span>Rs. {formatCurrency(totals.totalSgst)}</span>
            </div>
            <div className="inv-summary-row">
              <span>Total IGST</span>
              <span>Rs. {formatCurrency(totals.totalIgst)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="inv-summary-row">
                <span>Discount {bill.discount_type === "PERCENTAGE" ? `(${bill.discount_input}%)` : ""}</span>
                <span>- Rs. {formatCurrency(totals.discount)}</span>
              </div>
            )}
            <div className="inv-summary-row inv-summary-grand purchase-grand">
              <span>Grand Total</span>
              <span>Rs. {formatCurrency(totals.grandTotal)}</span>
            </div>
            <div className="inv-summary-row">
              <span>Previous Balance <span className="text-muted" style={{ fontSize: "0.75em" }}>(with Vendor)</span></span>
              <span>
                {totals.previousBalance < 0 ? (
                  <span className="text-danger">Payable: Rs. {formatCurrency(Math.abs(totals.previousBalance))}</span>
                ) : totals.previousBalance > 0 ? (
                  <span className="text-success">Vendor Credit: Rs. {formatCurrency(totals.previousBalance)}</span>
                ) : (
                  <span>Clear</span>
                )}
              </span>
            </div>
            <div className="inv-summary-row">
              <span>Amount Paid</span>
              <span>Rs. {formatCurrency(totals.paidAmount)}</span>
            </div>
            <div className="inv-summary-row">
              <span>{totals.balance < 0 ? "Payable to Vendor" : totals.balance > 0 ? "Vendor Credit" : "Balance Clear"}</span>
              <span>Rs. {formatCurrency(Math.abs(totals.balance))}</span>
            </div>
          </div>
        </div>

        <div className="inv-signatures">
          <div className="inv-sign-box">
          </div>
          <div className="inv-sign-box text-end">
            <div className="inv-signature-space">
              {company?.authorized_signature && (
                <AuthImage
                  src={company.authorized_signature}
                  alt="Authorised Signature"
                  className="inv-signature-image"
                />
              )}
            </div>
            <div className="inv-sign-line" />
            <div className="inv-sign-label">Authorised Signatory</div>
            <div className="inv-panel-text fw-medium">{company?.name}</div>
          </div>
        </div>

        <div className="inv-branding">
          trihubtechnologies.com
        </div>
      </div>

      <style>{`
        .invoice-paper {
          background: #fff;
          box-sizing: border-box;
          padding: 18px;
          margin: 0 auto 32px;
          color: #0f172a;
          font-family: "Segoe UI", Arial, sans-serif;
          font-size: 12px;
          box-shadow: 0 10px 36px rgba(15, 23, 42, 0.12);
        }

        .page-a3 { page: bill-a3; }
        .page-a4 { page: bill-a4; }
        .page-a5 { page: bill-a5; }
        .page-thermal { page: bill-thermal; }

        .print-toolbar {
          background: #f8fafc;
          border-bottom: 1px solid #dbe3ee;
          position: sticky;
          top: 0;
          z-index: 20;
        }

        .receipt-size-controls {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .receipt-size-controls .form-control {
          width: 88px;
        }

        .inv-header {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 18px;
        }

        .inv-header-left {
          display: flex;
          gap: 14px;
          flex: 1;
        }

        .inv-logo,
        .inv-logo-placeholder {
          width: 62px;
          height: 62px;
          border-radius: 12px;
          object-fit: contain;
          flex-shrink: 0;
        }

        .inv-logo-placeholder {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #047857, #10b981);
          color: #fff;
          font-size: 1.4rem;
          font-weight: 700;
        }

        .inv-company-name {
          font-size: 1.15rem;
          font-weight: 800;
          margin-bottom: 4px;
        }

        .inv-company-meta,
        .inv-panel-text {
          color: #475569;
          line-height: 1.55;
        }

        .inv-header-right {
          min-width: 240px;
        }

        .inv-title {
          text-align: right;
          font-size: 1.15rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          margin-bottom: 6px;
        }

        .purchase-title {
          color: #047857;
        }

        .inv-meta-table {
          width: 100%;
        }

        .inv-meta-table td {
          padding: 2px 0 2px 10px;
          vertical-align: top;
        }

        .inv-meta-table td:first-child {
          color: #64748b;
          width: 42%;
          padding-left: 0;
        }

        .inv-panel-grid,
        .inv-footer-grid,
        .inv-signatures {
          display: grid;
          gap: 14px;
          break-inside: avoid;
        }

        .inv-panel-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin-bottom: 14px;
        }

        .inv-panel {
          border: 1px solid #dbe3ee;
          border-radius: 14px;
          padding: 12px;
          background: #f7fdf9;
        }

        .inv-panel-title {
          font-size: 0.72rem;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 6px;
        }

        .inv-party-name {
          font-weight: 700;
          margin-bottom: 4px;
        }

        .inv-table-wrapper {
          overflow-x: auto;
          margin-bottom: 14px;
        }

        .inv-table {
          width: 100%;
          border-collapse: collapse;
        }

        .inv-table th {
          background: #047857;
          color: #fff;
          padding: 8px;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          white-space: nowrap;
        }

        .inv-table td {
          padding: 8px;
          border-bottom: 1px solid #e5edf7;
          vertical-align: top;
        }

        .inv-tax-amt {
          font-weight: 600;
          font-size: 0.95em;
        }

        .inv-tax-rate {
          font-size: 0.75em;
          color: #64748b;
        }

        .inv-product-name {
          font-weight: 700;
        }

        .inv-product-code {
          color: #64748b;
          font-size: 0.75rem;
        }

        .inv-footer-grid {
          grid-template-columns: minmax(0, 1fr) 280px;
          align-items: start;
        }

        .inv-note-block {
          border: 1px solid #dbe3ee;
          border-radius: 14px;
          padding: 12px;
          background: #fff;
          margin-bottom: 12px;
        }

        .inv-summary {
          border: 1px solid #dbe3ee;
          border-radius: 14px;
          overflow: hidden;
        }

        .inv-summary-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 9px 12px;
          border-bottom: 1px solid #e5edf7;
          font-size: 0.9rem;
        }

        .inv-summary-row:last-child {
          border-bottom: none;
        }

        .inv-summary-grand {
          color: #fff;
          font-weight: 700;
        }

        .purchase-grand {
          background: #047857;
        }

        .inv-signatures {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin-top: 14px;
        }

        .inv-sign-box {
          padding-top: 24px;
        }

        .inv-sign-line {
          border-top: 1px solid #94a3b8;
          margin-bottom: 6px;
        }

        .inv-signature-space {
          height: 54px;
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
          margin-bottom: 4px;
        }

        .inv-signature-image {
          max-width: 180px;
          max-height: 50px;
          object-fit: contain;
        }

        .inv-sign-label {
          color: #64748b;
          font-size: 0.8rem;
        }

        .inv-branding {
          margin-top: 24px;
          text-align: center;
          font-size: 0.7rem;
          color: #94a3b8;
          border-top: 1px solid #f1f5f9;
          padding-top: 8px;
        }

        .inv-receipt-items {
          display: none;
        }

        .inv-receipt-item {
          border-bottom: 1px dashed #cbd5e1;
          padding: 8px 0;
        }

        .inv-receipt-row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }

        .inv-receipt-name {
          font-weight: 600;
          flex: 1;
        }

        .inv-receipt-total {
          font-weight: 700;
          white-space: nowrap;
        }

        .inv-receipt-meta {
          font-size: 0.85em;
          color: #64748b;
          margin-top: 2px;
        }

        .page-thermal {
          padding: 10px;
          font-size: 9px;
        }

        .page-thermal .inv-header,
        .page-thermal .inv-footer-grid,
        .page-thermal .inv-panel-grid,
        .page-thermal .inv-signatures {
          grid-template-columns: 1fr;
          display: grid;
        }

        .page-thermal .inv-header {
          display: block;
        }

        .page-thermal .inv-header-right {
          min-width: 0;
          margin-top: 10px;
        }

        .page-thermal .inv-title {
          text-align: left;
        }

        .page-thermal .inv-table-wrapper {
          display: none;
        }

        .page-thermal .inv-receipt-items {
          display: block;
          margin-bottom: 10px;
        }

        .page-thermal .inv-summary {
          border-radius: 0;
          border-left: none;
          border-right: none;
        }

        .page-thermal .inv-note-block {
          border-radius: 0;
          border-left: none;
          border-right: none;
        }

        .page-a5 .inv-table {
          font-size: 10px;
        }

        .page-a5 .inv-table th,
        .page-a5 .inv-table td {
          padding: 5px 4px;
        }

        .page-a5 .inv-tax-rate {
          display: none;
        }

        @media (max-width: 768px) {
          .invoice-paper {
            width: 100% !important;
            padding: 14px 10px;
          }

          .inv-header,
          .inv-panel-grid,
          .inv-footer-grid,
          .inv-signatures {
            grid-template-columns: 1fr;
            display: grid;
          }

          .inv-header {
            display: block;
          }

          .inv-header-right {
            min-width: 0;
            margin-top: 12px;
          }

          .inv-title {
            text-align: left;
          }
        }

        @page bill-a3 {
          size: 297mm 420mm;
          margin: 0;
        }

        @page bill-a4 {
          size: 210mm 297mm;
          margin: 0;
        }

        @page bill-a5 {
          size: 148mm 210mm;
          margin: 0;
        }

        @page bill-thermal {
          size: ${paperWidthMm}mm ${paperHeightMm}mm;
          margin: 0;
        }

        @media print {
          .print-toolbar,
          .d-print-none {
            display: none !important;
          }

          html, body {
            margin: 0;
            padding: 0;
          }

          body * {
            visibility: hidden;
          }

          .invoice-print-wrapper,
          .invoice-print-wrapper *,
          #bill-print-area,
          #bill-print-area * {
            visibility: visible;
          }

          #bill-print-area {
            position: static;
            margin: 0 auto;
            box-shadow: none;
            width: 100% !important;
            min-height: 0 !important;
          }

          .invoice-paper {
            box-shadow: none !important;
            margin: 0 auto !important;
            padding: 12px !important;
          }

          .inv-table-wrapper {
            overflow-x: visible !important;
          }

          .inv-table {
            width: 100% !important;
            min-width: 0 !important;
            font-size: 10px;
          }

          .inv-table th,
          .inv-table td {
            padding: 5px 6px !important;
          }

          .inv-tax-rate {
            display: none;
          }

          .page-a5 .inv-table {
            font-size: 9px;
          }

          .page-a5 .inv-table th,
          .page-a5 .inv-table td {
            padding: 3px 4px !important;
          }

          .page-a5 .inv-summary-row {
            padding: 6px 8px !important;
            font-size: 0.85rem !important;
          }

          .page-thermal .inv-table-wrapper {
            display: none !important;
          }

          .page-thermal .inv-receipt-items {
            display: block !important;
          }

          .page-thermal .inv-receipt-item {
            border-bottom: 1px dashed #94a3b8 !important;
          }
        }
      `}</style>
    </div>
  );
}
