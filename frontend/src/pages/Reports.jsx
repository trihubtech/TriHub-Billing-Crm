import { useState, useEffect, useRef } from "react";
import api from "../utils/api";
import { toast } from "react-toastify";
import PageHeader from "../components/shared/PageHeader";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";

function formatCurrency(n) {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}

export default function Reports() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [from, setFrom] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0]; });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const printRef = useRef(null);
  const canViewReports = hasPermission(user, "can_view_reports");

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get("/reports");
        setReports(res.data.data);
      } catch { toast.error("Failed to load reports"); }
    }
    load();
  }, []);

  const fetchReport = async (reportId) => {
    if (!reportId) return;
    if (!canViewReports) {
      toast.error("You do not have permission to view report details");
      return;
    }
    setLoading(true);
    setSelectedReport(reportId);
    try {
      const res = await api.get(`/reports/${reportId}?from=${from}&to=${to}`);
      setData(res.data);
    } catch { toast.error("Failed to load report"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (selectedReport) fetchReport(selectedReport);
    
  }, [from, to, canViewReports]);

  const handlePrint = () => window.print();

  const grouped = reports.reduce((acc, r) => {
    (acc[r.category] = acc[r.category] || []).push(r);
    return acc;
  }, {});

  const getSummaryColor = (idx) => {
    const colors = ["primary", "success", "info", "warning", "danger", "secondary"];
    return colors[idx % colors.length];
  };

  const reportName = reports.find((r) => r.id === selectedReport)?.name ?? "";

  return (
    <div className="container-fluid px-0">
      <div className="d-print-none">
        <PageHeader title="Reports & Analytics" icon="fa-solid fa-chart-line" />
      </div>

      <div className="row g-4 mt-1">
        {}
        <div className="col-12 col-xl-3 col-lg-4 d-print-none">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body p-4">
              <h6 className="fw-bold mb-3 text-secondary">
                <i className="fa-solid fa-calendar-alt me-2"></i>Date Range
              </h6>
              <div className="row g-2 mb-4">
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">From</label>
                  <input type="date" className="form-control form-control-sm rounded-3 py-2" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="col-6">
                  <label className="form-label small text-muted mb-1">To</label>
                  <input type="date" className="form-control form-control-sm rounded-3 py-2" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </div>

              <hr className="text-muted opacity-25 my-4" />

              <h6 className="fw-bold mb-3 text-secondary">
                <i className="fa-solid fa-folder-open me-2"></i>Available Reports
              </h6>

              <div className="d-flex flex-column gap-3">
                {Object.entries(grouped).map(([cat, rpts]) => (
                  <div key={cat}>
                    <div className="text-uppercase text-muted fw-bolder mb-2" style={{ fontSize: "0.65rem", letterSpacing: "1px" }}>
                      {cat}
                    </div>
                    <div className="d-flex flex-column gap-1">
                      {rpts.map((r) => {
                        const isSelected = selectedReport === r.id;
                        return (
                          <button
                            key={r.id}
                            disabled={!canViewReports}
                            className={`btn btn-sm text-start border-0 rounded-3 px-3 py-2 fw-medium ${isSelected ? "bg-primary text-white shadow" : "btn-light text-secondary"
                              }`}
                            style={{ transition: "all 0.2s ease" }}
                            onClick={() => fetchReport(r.id)}
                          >
                            <i className={`fa-solid ${isSelected ? "fa-chart-pie" : "fa-file-lines"} me-2 opacity-75`}></i>
                            {r.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {}
        <div className="col-12 col-xl-9 col-lg-8" id="report-content-col">
          {loading ? (
            <div className="d-flex flex-column justify-content-center align-items-center min-vh-50 text-muted">
              <div className="spinner-border text-primary mb-3" style={{ width: "3rem", height: "3rem" }} />
              <h5 className="fw-light">Generating Report...</h5>
            </div>
          ) : !canViewReports ? (
            <div className="card border-0 shadow-sm rounded-4 min-vh-50 d-flex justify-content-center align-items-center">
              <div className="text-center p-5">
                <div className="bg-light rounded-circle d-inline-flex justify-content-center align-items-center mb-4" style={{ width: "100px", height: "100px" }}>
                  <i className="fa-solid fa-lock fa-3x text-warning opacity-75"></i>
                </div>
                <h4 className="fw-bold text-dark">Report View Access Needed</h4>
                <p className="text-muted mb-0">You can see the report catalog, but detailed report data needs view permission.</p>
              </div>
            </div>
          ) : !data ? (
            <div className="card border-0 shadow-sm rounded-4 min-vh-50 d-flex justify-content-center align-items-center">
              <div className="text-center p-5">
                <div className="bg-light rounded-circle d-inline-flex justify-content-center align-items-center mb-4" style={{ width: "100px", height: "100px" }}>
                  <i className="fa-solid fa-chart-column fa-3x text-primary opacity-50"></i>
                </div>
                <h4 className="fw-bold text-dark">No Report Selected</h4>
                <p className="text-muted">Select a report from the left panel and set your date range.</p>
              </div>
            </div>
          ) : (
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden" ref={printRef} id="report-print-card">

              {}
              <div className="d-none d-print-block px-4 pt-4 pb-2 border-bottom">
                <h4 className="mb-1 fw-bold">{reportName}</h4>
                <p className="text-muted mb-0 small">
                  {new Date(from).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} — {new Date(to).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>

              {}
              <div className="card-header bg-white border-bottom p-4 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 d-print-none">
                <div>
                  <h4 className="mb-1 fw-bold text-dark">{reportName}</h4>
                  <p className="text-muted mb-0 small">
                    <i className="fa-regular fa-calendar me-1"></i>
                    {new Date(from).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} to {new Date(to).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <button className="btn btn-primary shadow-sm rounded-pill px-4" onClick={handlePrint}>
                  <i className="fa-solid fa-print me-2"></i>Print / Download PDF
                </button>
              </div>

              <div className="card-body p-0">
                {}
                {data.data.summary && (
                  <div className="p-4 bg-light border-bottom">
                    <h6 className="fw-bold text-secondary mb-3 small text-uppercase">Summary</h6>
                    <div className="row g-3">
                      {Object.entries(data.data.summary).map(([key, val], idx) => {
                        const color = getSummaryColor(idx);
                        const isMoney = typeof val === "number" && !key.includes("qty") && !key.includes("count");
                        return (
                          <div key={key} className="col-12 col-sm-6 col-md-4 col-xl-3">
                            <div className="card border-0 shadow-sm rounded-3 overflow-hidden h-100">
                              <div className={`card-body p-3 border-start border-4 border-${color}`}>
                                <div className="text-muted text-uppercase fw-semibold mb-1 text-truncate" style={{ fontSize: "0.7rem", letterSpacing: "0.5px" }}>
                                  {key.replace(/_/g, " ")}
                                </div>
                                <h4 className={`mb-0 fw-bold text-${color}`}>
                                  {isMoney ? `₹${formatCurrency(val)}` : val}
                                </h4>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {}
                {selectedReport === "profit_loss" && !data.data.rows ? (
                  <div className="p-4 p-md-5">
                    <div className="row justify-content-center">
                      <div className="col-12 col-xl-8">
                        <div className="card border-0 bg-light rounded-4 shadow-sm">
                          <div className="card-body p-4 p-md-5">
                            <h5 className="fw-bold mb-4 text-center border-bottom pb-3">Financial Statement</h5>
                            <div className="d-flex justify-content-between align-items-center mb-3">
                              <span className="fs-5 text-muted">Revenue (Sales)</span>
                              <span className="fs-5 fw-bold text-success">₹{formatCurrency(data.data.revenue)}</span>
                            </div>
                            <div className="d-flex justify-content-between align-items-center mb-3">
                              <span className="fs-5 text-muted">Cost of Goods (Purchases)</span>
                              <span className="fs-5 fw-bold text-danger">- ₹{formatCurrency(data.data.cost_of_goods)}</span>
                            </div>
                            <div className={`alert ${data.data.gross_profit >= 0 ? "alert-success" : "alert-danger"} d-flex flex-wrap justify-content-between align-items-center py-3 my-4 rounded-3`}>
                              <span className="fs-4 fw-bold">Gross Profit</span>
                              <span className="fs-3 fw-bolder">₹{formatCurrency(data.data.gross_profit)}</span>
                            </div>
                            <hr className="my-4 text-muted opacity-25" />
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <span className="text-muted">Discounts Given</span>
                              <span className="fw-medium">₹{formatCurrency(data.data.discounts_given)}</span>
                            </div>
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <span className="text-muted">Tax Collected (GST)</span>
                              <span className="fw-medium text-success">₹{formatCurrency(data.data.tax_collected)}</span>
                            </div>
                            <div className="d-flex justify-content-between align-items-center mb-4">
                              <span className="text-muted">Tax Paid (Input GST)</span>
                              <span className="fw-medium text-danger">₹{formatCurrency(data.data.tax_paid)}</span>
                            </div>
                            <div className="d-flex justify-content-between align-items-center bg-white p-3 rounded-3 border shadow-sm">
                              <span className="fw-bold text-secondary">Net Tax Liability</span>
                              <span className="fs-5 fw-bold text-dark">₹{formatCurrency(data.data.net_tax)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                ) : data.data.rows ? (
                  
                  <div className="p-0">
                    {/* Desktop table - hidden on mobile */}
                    <div className="table-responsive report-table-scroll d-none d-md-block" id="report-table-wrap">
                      <table className="table table-hover table-borderless align-middle mb-0" id="report-table">
                        <thead className="table-light sticky-top" style={{ zIndex: 1 }}>
                          <tr>
                            {data.data.rows.length > 0 &&
                              Object.keys(data.data.rows[0]).map((col, idx) => (
                                <th
                                  key={col}
                                  className={`text-uppercase text-secondary fw-bold py-3 ${idx === 0 ? "ps-4 pe-3" : "px-3"}`}
                                  style={{ fontSize: "0.75rem", letterSpacing: "0.5px" }}
                                >
                                  {col.replace(/_/g, " ")}
                                </th>
                              ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.data.rows.map((row, idx) => (
                            <tr key={idx} className="border-bottom report-row">
                              {Object.entries(row).map(([key, val], colIdx) => {
                                const isNumber = typeof val === "number";
                                const isMoney = isNumber && !key.includes("qty") && !key.includes("count") && !key.includes("_id") && key !== "id";
                                return (
                                  <td
                                    key={key}
                                    className={`py-3 ${colIdx === 0 ? "ps-4 pe-3 fw-bold text-dark" : "px-3 text-secondary"}`}
                                    style={{ fontSize: "0.875rem" }}
                                  >
                                    {isNumber ? (
                                      isMoney ? (
                                        <span className="report-money">₹{formatCurrency(val)}</span>
                                      ) : (
                                        <span className="fw-semibold">{val}</span>
                                      )
                                    ) : (
                                      val || <span className="text-black-50">—</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}

                          {data.data.rows.length === 0 && (
                            <tr>
                              <td colSpan="100" className="text-center py-5">
                                <div className="py-4">
                                  <i className="fa-regular fa-folder-open fa-3x text-muted opacity-25 mb-3 d-block"></i>
                                  <h5 className="text-muted fw-bold">No records found</h5>
                                  <p className="text-muted small mb-0">Try adjusting the date range.</p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>

                        {}
                        {data.data.totals && (
                          <tfoot>
                            <tr className="table-light fw-bold border-top border-2">
                              {Object.entries(data.data.totals).map(([key, val], colIdx) => {
                                const isNumber = typeof val === "number";
                                const isMoney = isNumber && !key.includes("qty") && !key.includes("count");
                                return (
                                  <td key={key} className={`py-3 ${colIdx === 0 ? "ps-4 pe-3" : "px-3"}`} style={{ fontSize: "0.875rem" }}>
                                    {isNumber
                                      ? isMoney
                                        ? <span className="report-money">₹{formatCurrency(val)}</span>
                                        : val
                                      : val || ""}
                                  </td>
                                );
                              })}
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>

                    {/* Mobile card layout */}
                    <div className="d-md-none p-3">
                      {data.data.rows.length === 0 ? (
                        <div className="text-center py-5">
                          <i className="fa-regular fa-folder-open fa-3x text-muted opacity-25 mb-3 d-block"></i>
                          <h5 className="text-muted fw-bold">No records found</h5>
                          <p className="text-muted small mb-0">Try adjusting the date range.</p>
                        </div>
                      ) : (
                        <>
                          {data.data.rows.map((row, idx) => {
                            const entries = Object.entries(row);
                            const firstEntry = entries[0];
                            const restEntries = entries.slice(1);
                            return (
                              <div key={idx} className="card border-0 shadow-sm rounded-3 mb-2 overflow-hidden">
                                {firstEntry && (
                                  <div className="card-header bg-light border-bottom py-2 px-3">
                                    <div className="d-flex justify-content-between align-items-center">
                                      <span className="text-uppercase text-muted fw-bold" style={{ fontSize: "0.65rem", letterSpacing: "0.5px" }}>
                                        {firstEntry[0].replace(/_/g, " ")}
                                      </span>
                                      <span className="fw-bold text-dark small">{firstEntry[1] || "—"}</span>
                                    </div>
                                  </div>
                                )}
                                <div className="card-body py-2 px-3">
                                  {restEntries.map(([key, val]) => {
                                    const isNumber = typeof val === "number";
                                    const isMoney = isNumber && !key.includes("qty") && !key.includes("count") && !key.includes("_id") && key !== "id";
                                    return (
                                      <div key={key} className="d-flex justify-content-between align-items-center py-1 border-bottom" style={{ fontSize: "0.82rem" }}>
                                        <span className="text-muted text-capitalize">{key.replace(/_/g, " ")}</span>
                                        <span className={`fw-medium ${isMoney ? "text-dark" : ""}`}>
                                          {isNumber ? (isMoney ? `₹${formatCurrency(val)}` : val) : (val || "—")}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}

                          {/* Mobile totals */}
                          {data.data.totals && (
                            <div className="card border-0 shadow-sm rounded-3 overflow-hidden bg-primary bg-opacity-10 mt-3">
                              <div className="card-header bg-primary bg-opacity-10 border-bottom py-2 px-3">
                                <span className="fw-bold text-primary small text-uppercase">Totals</span>
                              </div>
                              <div className="card-body py-2 px-3">
                                {Object.entries(data.data.totals).map(([key, val]) => {
                                  const isNumber = typeof val === "number";
                                  const isMoney = isNumber && !key.includes("qty") && !key.includes("count");
                                  return (
                                    <div key={key} className="d-flex justify-content-between align-items-center py-1 border-bottom" style={{ fontSize: "0.85rem" }}>
                                      <span className="text-muted text-capitalize fw-medium">{key.replace(/_/g, " ")}</span>
                                      <span className="fw-bold text-dark">
                                        {isNumber ? (isMoney ? `₹${formatCurrency(val)}` : val) : (val || "")}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .min-vh-50 { min-height: 50vh; }

        
        @media screen {
          .report-table-scroll {
            max-height: 650px;
            overflow-y: auto;
          }
        }

        
        @media print {
          
          @page {
            size: A4 landscape;
            margin: 12mm 10mm 14mm 10mm;
          }

          
          body > * { visibility: hidden; }
          #report-print-card,
          #report-print-card * { visibility: visible; }

          #report-print-card {
            position: fixed;
            top: 0; left: 0; right: 0;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
          }

          
          #report-table-wrap {
            display: block !important;
          }
          .d-md-none {
            display: none !important;
          }

          
          .report-table-scroll {
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
          }

          
          #report-table {
            width: 100% !important;
            table-layout: auto !important;
            border-collapse: collapse !important;
            font-size: 9pt !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          
          #report-table thead {
            display: table-header-group;
          }
          #report-table tfoot {
            display: table-footer-group;
          }
          #report-table tbody {
            display: table-row-group;
          }

          
          #report-table th,
          #report-table td {
            padding: 5pt 6pt !important;
            font-size: 8.5pt !important;
            white-space: normal !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
            vertical-align: middle !important;
            border-bottom: 0.5pt solid #dee2e6 !important;
          }

          
          #report-table thead th {
            background-color: #f8f9fa !important;
            color: #495057 !important;
            font-weight: 700 !important;
            border-bottom: 1.5pt solid #dee2e6 !important;
            letter-spacing: 0.3pt;
          }

          
          #report-table tfoot td {
            background-color: #f8f9fa !important;
            font-weight: 700 !important;
            border-top: 1.5pt solid #dee2e6 !important;
          }

          
          #report-table tr {
            page-break-inside: avoid;
          }

          
          .report-money {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            font-size: 8.5pt !important;
            font-weight: 700 !important;
            color: #1a1a1a !important;
          }

          
          .card-body .row {
            display: flex !important;
            flex-wrap: wrap !important;
          }
          .card-body .row > [class*="col-"] {
            flex: 0 0 25% !important;
            max-width: 25% !important;
          }
          .card-body .border-start {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          
          .card-body .row.justify-content-center > div {
            flex: 0 0 80% !important;
            max-width: 80% !important;
          }

          
          .sticky-top {
            position: static !important;
          }

          
          .d-print-block { display: block !important; }
        }
      `}</style>
    </div>
  );
}
