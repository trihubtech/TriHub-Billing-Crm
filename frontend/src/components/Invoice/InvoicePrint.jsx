import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { buildUpiUri, formatCurrency, formatDate, numberToWords, round2 } from "../../utils/invoiceUtils";
import { useAuth } from "../../context/AuthContext";
import api from "../../utils/api";
import { toast } from "react-toastify";
import AuthImage from "../shared/AuthImage";

const SIZES = {
  A4: { label: "A4", cssClass: "page-a4", icon: "fa-file", widthMm: 210, heightMm: 297 },
  A3: { label: "A3", cssClass: "page-a3", icon: "fa-file", widthMm: 297, heightMm: 420 },
  A5: { label: "A5", cssClass: "page-a5", icon: "fa-file", widthMm: 148, heightMm: 210 },
  THERMAL: { label: "Receipt", cssClass: "page-thermal", icon: "fa-receipt", widthMm: 80, heightMm: 220, isReceipt: true },
};

const clampPaperValue = (value, fallback, min, max) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
};

function deriveInvoiceSnapshot(invoice) {
  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  const discount = round2(Number(invoice?.discount) || 0);

  
  const subTotal = items.length
    ? round2(items.reduce((sum, item) => sum + Number(item.value ?? item.sub_total ?? 0), 0))
    : round2(Number(invoice?.sub_total) || 0);

  const totalTax = items.length
    ? round2(items.reduce((sum, item) => sum + Number(item.tax_value ?? item.taxValue ?? item.total_tax ?? 0), 0))
    : round2(Number(invoice?.total_tax) || 0);

  const rawGrand = round2(subTotal - discount + totalTax);
  const grandTotal = round2(Math.round(rawGrand));
  const roundOff = round2(grandTotal - rawGrand);
  const paidAmount = round2(Number(invoice?.paid_amount) || 0);
  
  const previousBalance = round2(Number(invoice?.previous_balance) || 0);
  const netPayable = round2(grandTotal - previousBalance);

  
  const balance = round2(previousBalance + paidAmount - grandTotal);
  const status = balance >= -0.01 ? "PAID" : (paidAmount > 0.01 ? "PARTIAL" : "UNPAID");

  return {
    subTotal,
    totalTax,
    discount,
    roundOff,
    grandTotal,
    paidAmount,
    previousBalance,
    netPayable,
    balance,
    status,
    amountInWords: invoice?.amount_in_words?.trim() || numberToWords(grandTotal),
  };
}

export default function InvoicePrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const printRef = useRef(null);
  const { company: authCompany } = useAuth();

  const [invoice, setInvoice] = useState(null);
  const [company, setCompany] = useState(authCompany || null);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState("A4");
  const [receiptWidthMm, setReceiptWidthMm] = useState(SIZES.THERMAL.widthMm);
  const [receiptHeightMm, setReceiptHeightMm] = useState(SIZES.THERMAL.heightMm);

  const hasTax = invoice?.items?.some((item) => Number(item.tax_rate) > 0) ?? false;

  useEffect(() => {
    if (authCompany) {
      setCompany((current) => (current ? { ...current, ...authCompany } : authCompany));
    }
  }, [authCompany]);

  useEffect(() => {
    async function load() {
      try {
        const [invRes, compRes] = await Promise.all([
          api.get(`/invoices/${id}`),
          api.get("/profile/company").catch(() => ({ data: { data: authCompany || null } })),
        ]);
        setInvoice(invRes.data.data);
        setCompany(compRes.data.data || authCompany || null);
      } catch {
        toast.error("Failed to load invoice.");
        navigate("/invoices");
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

  const handleDownload = useCallback(() => {
    window.print();
  }, []);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "300px" }}>
        <div className="spinner-border text-primary" />
      </div>
    );
  }

  if (!invoice) return null;

  const totals = deriveInvoiceSnapshot(invoice);

  const upiUri = company?.upi_id
    ? buildUpiUri({
        upiId: company.upi_id,
        payeeName: company.upi_name || company.name,
        amount: Math.abs(totals.balance),
        invoiceNumber: invoice.code,
      })
    : null;
  const hasBalanceDue = totals.balance < -0.01;
  const shouldShowQrSection = hasBalanceDue && Boolean(company?.upi_qr_image || upiUri);

  async function handleCopyPaymentLink() {
    if (!upiUri) return;

    try {
      await navigator.clipboard.writeText(upiUri);
      toast.success("Payment link copied.");
    } catch {
      toast.error("Unable to copy payment link.");
    }
  }

  const statusColors = {
    PAID: "success",
    PARTIAL: "warning",
    UNPAID: "danger",
  };

  return (
    <div className="invoice-print-wrapper">
      <div className="print-toolbar d-print-none">
        <div className="container-fluid">
          <div className="d-flex flex-wrap align-items-center gap-2 py-2">
            <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate("/invoices")}>
              <i className="fa-solid fa-arrow-left me-1"></i> Invoices
            </button>

            <button className="btn btn-outline-primary btn-sm" onClick={() => navigate(`/invoices/${id}/edit`)}>
              <i className="fa-solid fa-pen-to-square me-1"></i> Edit
            </button>

            <div className="vr d-none d-md-block"></div>

            <div className="d-flex gap-1">
              {Object.entries(SIZES).map(([key, val]) => (
                <button
                  key={key}
                  className={`btn btn-sm ${size === key ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setSize(key)}
                  title={`Print as ${val.label}`}
                >
                  <i className={`fa-regular ${val.icon} me-1`}></i>
                  <span className="d-none d-sm-inline">{val.label}</span>
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
                  onChange={(e) => setReceiptWidthMm(e.target.value)}
                  aria-label="Receipt width in millimeters"
                />
                <span className="small text-muted">x</span>
                <input
                  type="number"
                  min="60"
                  max="1000"
                  step="1"
                  className="form-control form-control-sm"
                  value={receiptHeightMm}
                  onChange={(e) => setReceiptHeightMm(e.target.value)}
                  aria-label="Receipt height in millimeters"
                />
              </div>
            )}

            <div className="ms-auto d-flex gap-2">
              <button className="btn btn-outline-dark btn-sm" onClick={handleDownload}>
                <i className="fa-solid fa-file-pdf me-1 text-danger"></i> PDF
              </button>
              <button className="btn btn-primary btn-sm" onClick={handlePrint}>
                <i className="fa-solid fa-print me-1"></i> Print
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`invoice-paper ${selectedSize.cssClass}`} style={paperStyle} ref={printRef} id="invoice-print-area">
        <div className="inv-header">
          <div className="inv-header-left">
            {company?.logo ? (
              <AuthImage src={company.logo} alt="Logo" className="inv-logo" />
            ) : (
              <div className="inv-logo-placeholder">
                <span>{(company?.name || "T").charAt(0)}</span>
              </div>
            )}
            <div>
              <div className="inv-company-name">{company?.name || "Your Company"}</div>
              {company?.address && <div className="inv-company-meta">{company.address}</div>}
              {company?.phone && <div className="inv-company-meta"><i className="fa-solid fa-phone fa-xs"></i> {company.phone}</div>}
              {company?.email && <div className="inv-company-meta"><i className="fa-regular fa-envelope fa-xs"></i> {company.email}</div>}
              {company?.gstin && <div className="inv-company-meta"><strong>GSTIN:</strong> {company.gstin}</div>}
            </div>
          </div>

          <div className="inv-header-right">
            <div className="inv-title">TAX INVOICE</div>
            <table className="inv-meta-table">
              <tbody>
                <tr>
                  <td>Invoice No.</td>
                  <td><strong>{invoice.code}</strong></td>
                </tr>
                <tr>
                  <td>Date</td>
                  <td>{formatDate(invoice.date)}</td>
                </tr>
                <tr>
                  <td>Payment</td>
                  <td>{invoice.term}</td>
                </tr>
                <tr>
                  <td>Status</td>
                  <td>
                    <span className={`inv-badge inv-badge-${statusColors[totals.status]}`}>
                      {totals.status}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="inv-divider"></div>

        <div className="inv-bill-to">
          <div className="inv-section-label">Bill To</div>
          <div className="inv-customer-name">
            {invoice.customer_salutation} {invoice.customer_name}
          </div>
          {invoice.customer_address && <div className="inv-customer-meta">{invoice.customer_address}</div>}
          {invoice.customer_mobile && (
            <div className="inv-customer-meta">
              <i className="fa-solid fa-phone fa-xs"></i> {invoice.customer_mobile}
            </div>
          )}
          {invoice.customer_gstin && (
            <div className="inv-customer-meta">
              <strong>GSTIN:</strong> {invoice.customer_gstin}
            </div>
          )}
        </div>

        {size === "THERMAL" ? (
          <table className="inv-table" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={{ width: "50%" }}>Item</th>
                <th style={{ width: "20%", textAlign: "center" }}>Qty</th>
                <th style={{ width: "30%", textAlign: "right" }}>Amt</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td style={{ wordBreak: "break-word" }}>{item.product_name}</td>
                  <td style={{ textAlign: "center" }}>{item.quantity}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(item.total_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="inv-table">
            <thead>
              <tr>
                <th className="inv-th-sno">#</th>
                <th className="inv-th-product">Product / Description</th>
                <th className="inv-th-num">Unit</th>
                <th className="inv-th-num">Qty</th>
                <th className="inv-th-num">Rate</th>
                <th className="inv-th-num">Value</th>
                {hasTax && <th className="inv-th-num">GST%</th>}
                {hasTax && <th className="inv-th-num">Tax</th>}
                <th className="inv-th-num">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, idx) => (
                <tr key={item.id} className={idx % 2 === 0 ? "inv-tr-even" : ""}>
                  <td className="inv-td-sno">{idx + 1}</td>
                  <td>
                    <div className="inv-product-name">{item.product_name}</div>
                    {item.product_code && <div className="inv-product-code">{item.product_code}</div>}
                  </td>
                  <td className="inv-td-num">{item.product_unit}</td>
                  <td className="inv-td-num">{item.quantity}</td>
                  <td className="inv-td-num">{formatCurrency(item.rate)}</td>
                  <td className="inv-td-num">{formatCurrency(item.value)}</td>
                  {hasTax && (
                    <td className="inv-td-num">
                      {Number(item.tax_rate) > 0 ? `${item.tax_rate}%` : "-"}
                    </td>
                  )}
                  {hasTax && (
                    <td className="inv-td-num">
                      {Number(item.tax_value) > 0 ? formatCurrency(item.tax_value) : "-"}
                    </td>
                  )}
                  <td className="inv-td-num inv-td-total">{formatCurrency(item.total_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="inv-footer-section">
          <div className="inv-footer-left">
            <div className="inv-words-label">Amount in Words</div>
            <div className="inv-words-value">{totals.amountInWords}</div>

            {invoice.notes && (
              <div className="inv-notes">
                <div className="inv-notes-label">Notes</div>
                <div>{invoice.notes}</div>
              </div>
            )}

            {shouldShowQrSection && (
              <div className="inv-qr-section">
                <div className="inv-qr-label">
                  <i className="fa-solid fa-qrcode me-1"></i>Scan to Pay
                </div>
                {company?.upi_qr_image ? (
                  <AuthImage
                    src={company.upi_qr_image}
                    alt="Company UPI QR"
                    className="inv-qr-code inv-qr-image"
                  />
                ) : (
                  <a className="inv-qr-link" href={upiUri} aria-label={`Pay invoice ${invoice.code}`}>
                    <QRCodeSVG
                      value={upiUri}
                      size={size === "THERMAL" ? 90 : 110}
                      level="M"
                      includeMargin={false}
                      className="inv-qr-code"
                    />
                  </a>
                )}
                <div className="inv-qr-amount">
                  ₹ {formatCurrency(Math.abs(totals.balance))}
                </div>
                {company?.upi_id && <div className="inv-qr-upi">{company.upi_id}</div>}
                {upiUri && (
                  <div className="inv-payment-actions d-print-none">
                    <a className="btn btn-primary btn-sm" href={upiUri}>
                      <i className="fa-solid fa-bolt me-1"></i>Pay Balance Now
                    </a>
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleCopyPaymentLink}>
                      <i className="fa-regular fa-copy me-1"></i>Copy Link
                    </button>
                  </div>
                )}
                <div className="inv-qr-hint">PhonePe · GPay · Paytm · BHIM</div>
              </div>
            )}
            {totals.paidAmount > 0 && hasBalanceDue && (
              <div className="inv-total-row">
                <span>Paid</span>
                <span>₹ {formatCurrency(totals.paidAmount)}</span>
              </div>
            )}
            {hasBalanceDue && (
              <div className="inv-total-row inv-balance">
                <span>Balance Due</span>
                <span>₹ {formatCurrency(Math.abs(totals.balance))}</span>
              </div>
            )}
          </div>

          <div className="inv-totals-table">
            <div className="inv-total-row">
              <span>Sub Total</span>
              <span>₹ {formatCurrency(totals.subTotal)}</span>
            </div>
            {totals.totalTax > 0 && (
              <div className="inv-total-row">
                <span>Total GST</span>
                <span>₹ {formatCurrency(totals.totalTax)}</span>
              </div>
            )}
            {totals.discount > 0 && (
              <div className="inv-total-row inv-total-discount">
                <span>Discount</span>
                <span>- ₹ {formatCurrency(totals.discount)}</span>
              </div>
            )}
            {totals.roundOff !== 0 && (
              <div className="inv-total-row">
                <span>Round Off</span>
                <span>{totals.roundOff > 0 ? "+" : ""}₹ {formatCurrency(Math.abs(totals.roundOff))}</span>
              </div>
            )}
            <div className="inv-total-row inv-grand-total">
              <span>Grand Total</span>
              <span>₹ {formatCurrency(totals.grandTotal)}</span>
            </div>
            {totals.previousBalance !== 0 && (
              <div className="inv-total-row">
                <span>{totals.previousBalance < 0 ? "Previous Due" : "Previous Advance"}</span>
                <span className={totals.previousBalance < 0 ? "text-danger" : "text-success"}>
                  ₹ {formatCurrency(Math.abs(totals.previousBalance))}
                </span>
              </div>
            )}
            <div className="inv-total-row inv-net-payable" style={{ borderTop: "1px solid #ccc", marginTop: "4px" }}>
              <span className="fw-bold">Net Payable</span>
              <span className="fw-bold">₹ {formatCurrency(totals.netPayable)}</span>
            </div>
            <div className="inv-total-row">
              <span>Amount Paid</span>
              <span>₹ {formatCurrency(totals.paidAmount)}</span>
            </div>
            <div className={`inv-total-row ${totals.balance < 0 ? "inv-balance" : "inv-balance-clear"}`}>
              <span>{totals.balance < 0 ? "Balance Due" : (totals.balance > 0 ? "Advance Carryover" : "Balance Clear")}</span>
              <span>₹ {formatCurrency(Math.abs(totals.balance))}</span>
            </div>
          </div>
        </div>

        <div className="inv-signature-row">
          <div className="inv-signature-box">
            <div className="inv-signature-line"></div>
            <div className="inv-signature-label">Customer Signature</div>
          </div>
          <div className="inv-signature-box inv-signature-right">
            <div className="inv-signature-line"></div>
            <div className="inv-signature-label">Authorised Signatory</div>
            <div className="inv-signatory-name">{company?.name}</div>
          </div>
        </div>

        <div className="inv-page-footer">
          <span>This is a computer-generated invoice.</span>
          <span>Generated by TriHub</span>
        </div>
      </div>

      <style>{`
        .invoice-paper {
          background: #fff;
          box-sizing: border-box;
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 12px;
          color: #1a1a1a;
          padding: 28px 32px;
          margin: 0 auto 40px;
          max-width: 100%;
          box-shadow: 0 2px 20px rgba(0,0,0,0.12);
        }

        .page-a4 { page: invoice-a4; }
        .page-a3 { page: invoice-a3; font-size: 14px; }
        .page-a5 { page: invoice-a5; font-size: 10.5px; padding: 10mm 7mm 7mm; }
        .page-a5 .inv-header { margin-bottom: 8px; gap: 10px; }
        .page-a5 .inv-divider { margin-bottom: 8px; }
        .page-a5 .inv-bill-to { margin-bottom: 10px; }
        .page-thermal {
          page: invoice-thermal;
          min-height: auto;
          font-size: 9px;
          padding: 8px;
          background: #fff;
          color: #000;
        }
        .page-thermal .inv-company-name { font-size: 13px; }
        .page-thermal .inv-company-meta { font-size: 9px; }
        .page-thermal .inv-title { font-size: 16px; margin-bottom: 4px; }
        .page-thermal .inv-customer-name { font-size: 11px; }
        .page-thermal .inv-customer-meta { font-size: 9px; }
        .page-thermal .inv-table th { padding: 4px; font-size: 9px; }
        .page-thermal .inv-table td { padding: 4px; font-size: 9px; }
        .page-thermal .inv-product-name { font-size: 9.5px; white-space: normal; word-break: break-all; max-width: 100px; }
        .page-thermal .inv-th-sno, .page-thermal .inv-td-sno { width: 15px; padding-left: 2px; padding-right: 2px; }
        .page-thermal .inv-td-num { font-size: 9px; }
        .page-thermal .inv-totals-table { width: 100%; font-size: 9px; }
        .page-thermal .inv-grand-total { font-size: 11px; padding: 5px 8px; }
        .page-thermal .inv-qr-section { margin-top: 8px; }
        .page-thermal .inv-qr-amount { font-size: 11px; }
        .page-thermal .inv-signature-row { margin-top: 15px; }
        .page-thermal .inv-logo { width: 48px; height: 48px; }
        .page-thermal .inv-logo-placeholder { width: 40px; height: 40px; font-size: 18px; }

        .print-toolbar {
          background: #f8f9fa;
          border-bottom: 1px solid #dee2e6;
          position: sticky;
          top: 0;
          z-index: 100;
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

        .inv-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 14px; }
        .inv-header-left { display: flex; gap: 14px; align-items: flex-start; flex: 1; }
        .inv-logo { width: 64px; height: 64px; object-fit: contain; border-radius: 6px; }
        .inv-logo-placeholder {
          width: 56px;
          height: 56px;
          border-radius: 8px;
          background: linear-gradient(135deg, #0d6efd, #0a58ca);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 24px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .inv-company-name { font-size: 15px; font-weight: 700; color: #0d1117; margin-bottom: 2px; }
        .inv-company-meta { font-size: 10.5px; color: #555; line-height: 1.5; }
        .inv-header-right { text-align: right; flex-shrink: 0; }
        .inv-title { font-size: 20px; font-weight: 800; color: #0d6efd; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px; }
        .inv-meta-table td { padding: 2px 4px; font-size: 11px; }
        .inv-meta-table td:first-child { color: #666; padding-right: 10px; }
        .inv-badge { padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
        .inv-badge-success { background: #d1fae5; color: #065f46; }
        .inv-badge-warning { background: #fef3c7; color: #92400e; }
        .inv-badge-danger { background: #fee2e2; color: #991b1b; }

        .inv-divider { border: none; border-top: 2px solid #0d6efd; margin: 0 0 12px; }

        .inv-bill-to { margin-bottom: 14px; }
        .inv-section-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 3px; }
        .inv-customer-name { font-size: 13px; font-weight: 700; color: #0d1117; }
        .inv-customer-meta { font-size: 10.5px; color: #555; line-height: 1.6; }

        .inv-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        .inv-table th { background: #0d6efd; color: #fff; padding: 7px 10px; font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }
        .inv-table td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
        .inv-tr-even td { background: #f8faff; }
        .inv-th-sno, .inv-td-sno { width: 28px; text-align: center; }
        .inv-th-num { text-align: right; }
        .inv-td-num { text-align: right; font-size: 11px; }
        .inv-td-total { font-weight: 600; }
        .page-thermal .inv-table { table-layout: fixed; }
        .page-thermal .inv-table th, .page-thermal .inv-table td { overflow: hidden; text-overflow: ellipsis; }
        .page-thermal .inv-th-sno { width: 10%; }
        .page-thermal .inv-th-name { width: 45%; }
        .page-thermal .inv-th-qty { width: 15%; }
        .page-thermal .inv-th-total { width: 30%; }
        .inv-product-name { font-weight: 600; font-size: 11.5px; }
        .inv-product-code { font-size: 9.5px; color: #888; }

        .inv-footer-section { display: flex; gap: 24px; margin-bottom: 16px; }
        .inv-footer-left { flex: 1; }
        .inv-footer-left > .inv-total-row { display: none; }
        .inv-words-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 2px; }
        .inv-words-value { font-style: italic; font-size: 11px; color: #333; border-top: 1px solid #e5e7eb; padding-top: 4px; }
        .inv-notes { margin-top: 10px; font-size: 10.5px; color: #555; }
        .inv-notes-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 2px; }

        .inv-qr-section { margin-top: 14px; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
        .inv-qr-label { font-size: 10px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }
        .inv-qr-link { display: inline-flex; text-decoration: none; }
        .inv-qr-code { border: 2px solid #0d6efd; border-radius: 6px; padding: 4px; display: block; background: #fff; }
        .inv-qr-amount { font-size: 13px; font-weight: 700; color: #0d6efd; }
        .inv-qr-upi { font-size: 9.5px; color: #555; font-family: monospace; }
        .inv-qr-hint { font-size: 9px; color: #999; }
        .inv-payment-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }

        .inv-totals-table { width: 240px; flex-shrink: 0; }
        .inv-total-row { display: flex; justify-content: space-between; padding: 4px 10px; font-size: 11px; border-bottom: 1px solid #f0f0f0; }
        .inv-total-row span:last-child { font-variant-numeric: tabular-nums; }
        .inv-total-discount span { color: #dc3545; }
        .inv-grand-total { background: #0d6efd; color: #fff !important; font-weight: 700; font-size: 13px; border-radius: 4px; border-bottom: none; padding: 7px 10px; margin-top: 4px; }
        .inv-grand-total span { color: #fff !important; }
        .inv-balance { background: #fee2e2; color: #991b1b; font-weight: 600; border-radius: 4px; }
        .inv-balance span { color: #991b1b; }
        .inv-balance-clear { background: #dcfce7; color: #166534; font-weight: 600; border-radius: 4px; }
        .inv-balance-clear span { color: #166534; }

        .inv-signature-row { display: flex; justify-content: space-between; margin-top: 24px; margin-bottom: 12px; }
        .inv-signature-box { width: 40%; }
        .inv-signature-right { text-align: right; }
        .inv-signature-line { border-top: 1px solid #999; margin-bottom: 4px; }
        .inv-signature-label { font-size: 10px; color: #666; }
        .inv-signatory-name { font-size: 11px; font-weight: 600; }

        .inv-page-footer { display: flex; justify-content: space-between; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 9.5px; color: #999; }

        .page-thermal .inv-header { flex-direction: column; gap: 6px; }
        .page-thermal .inv-header-right { text-align: left; }
        .page-thermal .inv-footer-section { flex-direction: column; }
        .page-thermal .inv-totals-table { width: 100%; }
        .page-thermal .inv-qr-section { align-items: center; width: 100%; }
        .page-thermal .inv-signature-row { flex-direction: column; gap: 16px; }
        .page-thermal .inv-signature-box { width: 100%; }

        @page invoice-a4 { size: 210mm 297mm; margin: 0; }
        @page invoice-a3 { size: 297mm 420mm; margin: 0; }
        @page invoice-a5 { size: 148mm 210mm; margin: 0; }
        @page invoice-thermal { size: ${paperWidthMm}mm ${paperHeightMm}mm; margin: 0; }

        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }

          .d-print-none,
          .print-toolbar {
            display: none !important;
          }

          .invoice-print-wrapper {
            margin: 0 !important;
            padding: 0 !important;
          }

          body * { visibility: hidden; }
          #invoice-print-area, #invoice-print-area * { visibility: visible; }
          #invoice-print-area {
            position: static;
            box-shadow: none;
            margin: 0;
          }
          .invoice-paper {
            box-shadow: none !important;
            margin: 0 !important;
            min-height: auto !important;
            height: auto !important;
            break-after: avoid-page;
            page-break-after: avoid;
          }
          .page-a4 { width: 210mm !important; }
          .page-a3 { width: 297mm !important; }
          .page-a5 { width: 148mm !important; }
          .page-thermal { width: ${paperWidthMm}mm !important; }
        }

        @media (max-width: 768px) {
          .invoice-paper { width: 100% !important; padding: 16px 12px; }
          .inv-header { flex-direction: column; }
          .inv-footer-section { flex-direction: column; }
          .inv-totals-table { width: 100%; }
          .inv-payment-actions { width: 100%; }
          .inv-payment-actions .btn { flex: 1 1 180px; }
        }
      `}</style>
    </div>
  );
}
