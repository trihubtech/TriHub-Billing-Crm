import AuthImage from "../shared/AuthImage";
import { formatIndiaDate } from "../../utils/time";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function detailLines(party) {
  return [
    party?.name,
    party?.address,
    [party?.state_name, party?.state_code ? `State Code: ${party.state_code}` : ""].filter(Boolean).join("  "),
    party?.gstin ? `GSTIN: ${party.gstin}` : "",
    party?.mobile ? `Phone: ${party.mobile}` : "",
    party?.email ? `Email: ${party.email}` : "",
  ].filter(Boolean);
}

function renderPartyLines(party) {
  const lines = detailLines(party);
  if (!lines.length) {
    return <div className="gst-doc-dots">........</div>;
  }
  return lines.map((line, index) => (
    <div key={`${line}-${index}`} className="gst-doc-line">{line}</div>
  ));
}

export default function GstInvoiceDocument({
  invoices,
  selectedInvoiceId,
  onSelectInvoice,
  documentData,
  loadingDocument,
  onPrint,
  onDownloadExcel,
}) {
  const invoice = documentData?.invoice;
  const company = documentData?.company;
  const billing = documentData?.billing;
  const shipping = documentData?.shipping;
  const items = documentData?.items || [];
  const summary = documentData?.summary;
  const terms = documentData?.terms || [];

  return (
    <div className="gst-document-shell">
      <div className="card-header bg-white border-bottom p-4 d-print-none">
        <div className="row g-3 align-items-end">
          <div className="col-12 col-lg-6">
            <label className="form-label small fw-semibold text-muted mb-2">Choose Invoice</label>
            <select
              className="form-select rounded-3"
              value={selectedInvoiceId || ""}
              onChange={(event) => onSelectInvoice(event.target.value)}
            >
              {!invoices.length && <option value="">No invoices found in this date range</option>}
              {invoices.map((row) => (
                <option key={row.id} value={row.id}>
                  {(row.number || row.code)} - {row.customer_name || "Customer"} - {formatIndiaDate(row.date)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-lg-6">
            <div className="d-flex flex-wrap gap-2 justify-content-lg-end">
              <button className="btn btn-outline-success rounded-pill px-4" onClick={onDownloadExcel} disabled={!selectedInvoiceId || loadingDocument}>
                <i className="fa-solid fa-file-excel me-2"></i>Download Excel
              </button>
              <button className="btn btn-primary rounded-pill px-4" onClick={onPrint} disabled={!selectedInvoiceId || loadingDocument}>
                <i className="fa-solid fa-print me-2"></i>Print / Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card-body p-3 p-md-4 bg-body-tertiary">
        {loadingDocument ? (
          <div className="d-flex flex-column justify-content-center align-items-center py-5 text-muted">
            <div className="spinner-border text-primary mb-3" />
            <div>Preparing GST invoice document...</div>
          </div>
        ) : !invoice ? (
          <div className="text-center py-5 text-muted">
            <i className="fa-regular fa-file-lines fa-3x opacity-25 mb-3 d-block"></i>
            <div>Select an invoice to generate the GST document preview.</div>
          </div>
        ) : (
          <div className="gst-document-preview-wrap">
            <div className="gst-document-page" id="gst-document-page">


              <div className="gst-document-header">
                <div className="gst-document-logo-box">
                  {company?.logo ? (
                    <AuthImage src={company.logo} alt={company.name} className="gst-document-logo" />
                  ) : (
                    <span>LOGO</span>
                  )}
                </div>
                <div className="gst-document-company-block">
                  <div className="gst-document-company-name">{company?.name || "Company Name"}</div>
                  <div>{company?.address || ""}</div>
                  {company?.email && <div>{company.email}</div>}
                  {company?.website && <div>{company.website}</div>}
                  {company?.gstin && <div>GSTIN: {company.gstin}</div>}
                </div>
              </div>

              <div className="gst-document-meta-row">
                <div className="gst-document-meta-left">
                  <div><strong>Serial no. of Invoice:</strong> {invoice.number || invoice.code}</div>
                </div>
                <div className="gst-document-meta-right">
                  <div>Date &amp; Time of Supply : {invoice.formatted_date_time}</div>
                  <div>Place Of Supply: {invoice.place_of_supply || "-"}</div>
                  <div>Supply Type: {invoice.supply_label || invoice.supply_type || "-"}</div>
                </div>
              </div>

              <div className="gst-document-party-row">
                <div className="gst-document-party-box">
                  <div className="gst-document-party-title">Details of Receiver (Billed to)</div>
                  {renderPartyLines(billing)}
                </div>
                <div className="gst-document-party-box">
                  <div className="gst-document-party-title">Details of Consignee (Shipped to)</div>
                  {renderPartyLines(shipping)}
                </div>
              </div>

              <div className="gst-document-table-wrap">
                <table className="gst-document-table">
                  <thead>
                    <tr>
                      <th rowSpan="2">S.No</th>
                      <th rowSpan="2">Description of Goods</th>
                      <th rowSpan="2">HSN Code</th>
                      <th rowSpan="2">Qty</th>
                      <th rowSpan="2">Unit</th>
                      <th rowSpan="2">Rate</th>
                      <th rowSpan="2">Total</th>
                      <th rowSpan="2">Discount</th>
                      <th rowSpan="2">Taxable Value</th>
                      <th colSpan="2">CGST</th>
                      <th colSpan="2">SGST</th>
                      <th colSpan="2">IGST</th>
                    </tr>
                    <tr>
                      <th>Rate</th>
                      <th>Amount</th>
                      <th>Rate</th>
                      <th>Amount</th>
                      <th>Rate</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.sr_no}>
                        <td className="text-center">{item.sr_no}</td>
                        <td>{item.description}</td>
                        <td className="text-center">{item.hsn_sac_code || "-"}</td>
                        <td className="text-end">{formatCurrency(item.quantity)}</td>
                        <td className="text-center">{item.unit || "-"}</td>
                        <td className="text-end">{formatCurrency(item.rate)}</td>
                        <td className="text-end">{formatCurrency(item.gross_total)}</td>
                        <td className="text-end">{formatCurrency(item.discount_value)}</td>
                        <td className="text-end">{formatCurrency(item.taxable_value)}</td>
                        <td className="text-end">{item.cgst_rate ? `${formatCurrency(item.cgst_rate)}%` : "0.00%"}</td>
                        <td className="text-end">{formatCurrency(item.cgst_amount)}</td>
                        <td className="text-end">{item.sgst_rate ? `${formatCurrency(item.sgst_rate)}%` : "0.00%"}</td>
                        <td className="text-end">{formatCurrency(item.sgst_amount)}</td>
                        <td className="text-end">{item.igst_rate ? `${formatCurrency(item.igst_rate)}%` : "0.00%"}</td>
                        <td className="text-end">{formatCurrency(item.igst_amount)}</td>
                      </tr>
                    ))}
                    {!items.length && (
                      <tr>
                        <td colSpan="15" className="text-center py-4">No invoice items found</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="7"></td>
                      <td className="text-end fw-bold">{formatCurrency(summary?.discount)}</td>
                      <td className="text-end fw-bold">{formatCurrency(summary?.taxable_total)}</td>
                      <td></td>
                      <td className="text-end fw-bold">{formatCurrency(summary?.total_cgst)}</td>
                      <td></td>
                      <td className="text-end fw-bold">{formatCurrency(summary?.total_sgst)}</td>
                      <td></td>
                      <td className="text-end fw-bold">{formatCurrency(summary?.total_igst)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="gst-document-bottom-grid">
                <div className="gst-document-words-box">
                  <div className="gst-document-words-title">Invoice Total ( In Words ) :</div>
                  <div>{invoice.amount_in_words}</div>
                </div>
                <div className="gst-document-totals-box">
                  <div className="gst-document-total-row">
                    <span>Sub Total</span>
                    <span>{formatCurrency(summary?.gross_total)}</span>
                  </div>
                  {Number(summary?.discount) > 0 && (
                    <div className="gst-document-total-row">
                      <span>Discount</span>
                      <span>- {formatCurrency(summary?.discount)}</span>
                    </div>
                  )}
                  <div className="gst-document-total-row">
                    <span>Taxable Value</span>
                    <span>{formatCurrency(summary?.taxable_total)}</span>
                  </div>
                  <div className="gst-document-total-row">
                    <span>Total Tax</span>
                    <span>{formatCurrency(summary?.total_tax)}</span>
                  </div>
                  <div className="gst-document-total-row gst-document-total-final">
                    <span>Invoice Total</span>
                    <span>{formatCurrency(summary?.total_amount)}</span>
                  </div>
                </div>
              </div>

               <div className="gst-document-note-row">
                <div className="gst-document-note-left">
                  <div className="gst-document-note-title">Declaration</div>
                  <div className="small">Certified that the particulars given above are true and correct and the amount indicated represents the price actually charged and there is no flow of additional consideration directly or indirectly from the buyer.</div>
                </div>
                <div className="gst-document-note-right">
                  <div className="fw-bold">Reference Number:</div>
                  <div>{invoice.reference_number || invoice.number || invoice.code}</div>
                </div>
              </div>

              <div className="gst-document-footer-grid">
                <div className="gst-document-terms-box">
                  <div className="gst-document-note-title">TERMS OF SALE</div>
                  {terms.map((term, index) => (
                    <div key={index}>{index + 1}) {term}</div>
                  ))}
                  {invoice.notes?.map((note, index) => (
                    <div key={`note-${index}`}>{note}</div>
                  ))}
                </div>
                <div className="gst-document-sign-box">
                  <div className="gst-document-sign-company">For {company?.name || "Company Name"}</div>
                  <div className="gst-document-signature-space">
                    {company?.authorized_signature && (
                      <AuthImage
                        src={company.authorized_signature}
                        alt="Authorised Signature"
                        className="gst-document-signature-image"
                      />
                    )}
                  </div>
                  <div className="gst-document-sign-line">Authorised Signatory</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .gst-document-preview-wrap {
          overflow-x: auto;
          padding-bottom: 0.5rem;
        }

        .gst-document-page {
          width: 100%;
          min-width: 1080px;
          background: #fff;
          color: #111;
          border: 1px solid #1a1a1a;
          font-family: "Times New Roman", Georgia, serif;
        }

        .gst-document-top-note {
          text-align: center;
          font-style: italic;
          font-size: 12px;
          padding: 0.25rem 0;
          border-bottom: 1px solid #1a1a1a;
        }

        .gst-document-header,
        .gst-document-meta-row,
        .gst-document-party-row,
        .gst-document-bottom-grid,
        .gst-document-note-row,
        .gst-document-footer-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }

        .gst-document-header {
          min-height: 110px;
        }

        .gst-document-logo-box {
          width: 92px;
          height: 92px;
          border: 1px solid #1a1a1a;
          margin: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }

        .gst-document-logo {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        .gst-document-signature-space {
          min-height: 58px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          margin-top: auto;
        }

        .gst-document-signature-image {
          max-width: 190px;
          max-height: 54px;
          object-fit: contain;
        }

        .gst-document-company-block {
          border-left: 1px solid #1a1a1a;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
          text-align: center;
          padding: 0.75rem;
        }

        .gst-document-company-name {
          font-size: 2rem;
          font-weight: 700;
          line-height: 1.1;
        }

        .gst-document-meta-row > div,
        .gst-document-party-box,
        .gst-document-words-box,
        .gst-document-totals-box,
        .gst-document-note-left,
        .gst-document-note-right,
        .gst-document-terms-box,
        .gst-document-sign-box {
          border-top: 1px solid #1a1a1a;
          border-right: 1px solid #1a1a1a;
          padding: 0.45rem 0.5rem;
          font-size: 12px;
          min-height: 52px;
        }

        .gst-document-meta-row > div:last-child,
        .gst-document-party-box:last-child,
        .gst-document-bottom-grid > div:last-child,
        .gst-document-note-row > div:last-child,
        .gst-document-footer-grid > div:last-child {
          border-right: 0;
        }

        .gst-document-meta-right div,
        .gst-document-meta-left div,
        .gst-document-note-right div,
        .gst-document-terms-box div {
          margin-bottom: 0.15rem;
        }

        .gst-document-party-title,
        .gst-document-words-title,
        .gst-document-note-title {
          font-weight: 700;
          margin-bottom: 0.35rem;
        }

        .gst-doc-line,
        .gst-doc-dots {
          margin-bottom: 0.18rem;
          min-height: 14px;
        }

        .gst-document-table-wrap {
          border-top: 1px solid #1a1a1a;
          overflow-x: auto;
        }

        .gst-document-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .gst-document-table th,
        .gst-document-table td {
          border-right: 1px solid #1a1a1a;
          border-bottom: 1px solid #1a1a1a;
          padding: 0.25rem 0.3rem;
          vertical-align: top;
        }

        .gst-document-table th:last-child,
        .gst-document-table td:last-child {
          border-right: 0;
        }

        .gst-document-table thead th {
          text-align: center;
          font-weight: 700;
        }

        .gst-document-bottom-grid {
          grid-template-columns: minmax(0, 2fr) minmax(240px, 1fr);
        }

        .gst-document-totals-box {
          padding: 0;
        }

        .gst-document-total-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.35rem 0.5rem;
          border-bottom: 1px solid #1a1a1a;
        }

        .gst-document-total-row:last-child {
          border-bottom: 0;
        }

        .gst-document-total-final {
          font-weight: 700;
          justify-content: space-around;
        }

        .gst-document-footer-grid {
          min-height: 132px;
        }

        .gst-document-sign-box {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .gst-document-sign-company {
          font-weight: 700;
        }

        .gst-document-sign-line {
          text-align: center;
          font-weight: 700;
          margin-top: 0.35rem;
        }

        @media (max-width: 767.98px) {
          .gst-document-shell .card-header .row > div {
            width: 100%;
          }
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm;
          }

          body > * {
            visibility: hidden;
          }

          #report-print-card,
          #report-print-card * {
            visibility: visible;
          }

          #report-print-card {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            width: 100%;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .gst-document-shell .card-body {
            padding: 0 !important;
          }

          .gst-document-preview-wrap {
            overflow: visible !important;
            padding: 0 !important;
          }

          .gst-document-page {
            min-width: 0 !important;
            width: 100% !important;
            border: 1px solid #1a1a1a !important;
            font-size: 9px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .gst-document-company-name {
            font-size: 18px;
          }

          .gst-document-logo-box {
            width: 70px;
            height: 70px;
          }

          .gst-document-header {
            min-height: 80px;
          }

          .gst-document-table {
            font-size: 7.5px;
          }

          .gst-document-table th,
          .gst-document-table td {
            padding: 0.15rem 0.2rem;
          }

          .gst-document-meta-row > div,
          .gst-document-party-box,
          .gst-document-words-box,
          .gst-document-totals-box,
          .gst-document-note-left,
          .gst-document-note-right,
          .gst-document-terms-box,
          .gst-document-sign-box {
            font-size: 8px;
            min-height: 36px;
            padding: 0.25rem 0.35rem;
            break-inside: avoid;
          }

          .gst-document-footer-grid {
            min-height: 90px;
          }

          .gst-document-table th,
          .gst-document-table td {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
