import React, { useState, useEffect, useMemo } from "react";
import api from "../utils/api";
import { toast } from "react-toastify";
import PageHeader from "../components/shared/PageHeader";

const DURATIONS = [
  { id: "this_week", label: "This Week" },
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "last_6_months", label: "Last 6 Months" },
  { id: "last_1_year", label: "Last 1 Year" },
  { id: "custom", label: "Custom Range" },
];

function formatCurrency(n) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
}

export default function GstReports() {
  const [activeTab, setActiveTab] = useState("invoices"); // invoices or bills
  const [duration, setDuration] = useState("this_month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ duration });
      if (duration === "custom") {
        if (startDate) params.append("start_date", startDate);
        if (endDate) params.append("end_date", endDate);
      }
      const res = await api.get(`/reports/gst/${activeTab}?${params.toString()}`);
      setData(res.data);
    } catch (err) {
      toast.error("Failed to load GST report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (duration !== "custom" || (startDate && endDate)) {
      fetchReport();
    }
  }, [activeTab, duration, startDate, endDate]);

  const groupedData = useMemo(() => {
    if (!data || !data.products) return [];

    const groups = data.products.reduce((acc, p) => {
      const key = `${p.product_name}-${p.hsn_sac_code}-${p.gst_percentage}`;
      if (!acc[key]) {
        acc[key] = {
          product_name: p.product_name,
          product_tag: p.product_tag,
          hsn_sac_code: p.hsn_sac_code,
          gst_percentage: p.gst_percentage,
          transactions: [],
          totals: {
            igst: 0,
            cgst: 0,
            sgst: 0,
            total_gst: 0,
          },
        };
      }
      acc[key].transactions.push(p);
      acc[key].totals.igst += Number(p.igst_amount || 0);
      acc[key].totals.cgst += Number(p.cgst_amount || 0);
      acc[key].totals.sgst += Number(p.sgst_amount || 0);
      acc[key].totals.total_gst += Number(p.total_gst_amount || 0);
      return acc;
    }, {});

    return Object.values(groups);
  }, [data]);

  const handleExport = async () => {
    if (!data || !data.products.length) return;

    try {
      const params = new URLSearchParams({ duration });
      if (duration === "custom") {
        if (startDate) params.append("start_date", startDate);
        if (endDate) params.append("end_date", endDate);
      }
      
      const response = await api.get(`/reports/gst/${activeTab}/excel?${params.toString()}`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "application/vnd.ms-excel" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      
      const typeLabel = activeTab === "invoices" ? "Sales" : "Purchase";
      link.setAttribute("download", `GST_${typeLabel}_Report_${duration}.xls`);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Failed to export Excel report");
    }
  };


  return (
    <div className="container-fluid px-0">
      <PageHeader
        title="GST Reports"
        icon="fa-solid fa-receipt"
        subtitle="Dynamic product-wise tax breakdown"
      />

      {/* Tabs */}
      <div className="card border-0 shadow-sm rounded-4 mb-4 overflow-hidden">
        <div className="card-header bg-white p-0 border-bottom">
          <ul className="nav nav-pills nav-justified bg-light p-1">
            <li className="nav-item">
              <button
                className={`nav-link rounded-3 py-2 fw-bold ${activeTab === "invoices" ? "active bg-primary shadow-sm" : "text-secondary"}`}
                onClick={() => setActiveTab("invoices")}
              >
                <i className="fa-solid fa-file-invoice me-2"></i>Invoice GST (Sales)
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link rounded-3 py-2 fw-bold ${activeTab === "bills" ? "active bg-primary shadow-sm" : "text-secondary"}`}
                onClick={() => setActiveTab("bills")}
              >
                <i className="fa-solid fa-file-invoice-dollar me-2"></i>Bills GST (Purchases)
              </button>
            </li>
          </ul>
        </div>

        {/* Filters */}
        <div className="card-body p-3 p-md-4 bg-white">
          <div className="d-flex flex-wrap align-items-center gap-3">
            <div className="duration-pills-wrapper">
              <div className="btn-group shadow-sm rounded-pill p-1 bg-light">
                {DURATIONS.map((d) => (
                  <button
                    key={d.id}
                    className={`btn btn-sm rounded-pill px-3 py-1 fw-medium border-0 ${duration === d.id ? "btn-primary shadow-sm" : "text-muted hover-bg-white"}`}
                    onClick={() => setDuration(d.id)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {duration === "custom" && (
              <div className="d-flex align-items-center gap-2 animate__animated animate__fadeIn flex-grow-1 flex-md-grow-0">
                <input
                  type="date"
                  className="form-control form-control-sm rounded-3"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span className="text-muted small">to</span>
                <input
                  type="date"
                  className="form-control form-control-sm rounded-3"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            )}

            <div className="ms-md-auto w-100 w-md-auto mt-2 mt-md-0">
              <button
                className="btn btn-primary rounded-pill px-4 shadow-sm w-100"
                onClick={handleExport}
                disabled={!data || !data.products.length}
              >
                <i className="fa-solid fa-file-export me-2"></i>Export
              </button>
            </div>
          </div>

          {data && (
            <div className="mt-3 d-flex align-items-center justify-content-between">
              <p className="text-muted small mb-0 animate__animated animate__fadeIn">
                <i className="fa-regular fa-calendar-check me-2 text-primary"></i>
                Period: <span className="fw-bold text-dark">{data.duration_label}</span>
              </p>
              <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3">
                {data.products.length} Items Found
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Summaries - Grid responsive */}
      {data && (
        <div className="row g-3 g-md-4 mb-4 animate__animated animate__fadeInUp">
          <div className="col-6 col-md-3">
            <div className="card border-0 shadow-sm rounded-4 h-100 bg-white border-start border-primary border-4">
              <div className="card-body p-3 p-md-4">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <div className="bg-primary bg-opacity-10 p-1 px-2 rounded-2 text-primary">
                    <i className="fa-solid fa-earth-americas small"></i>
                  </div>
                  <h6 className="text-muted small text-uppercase fw-bold mb-0">IGST</h6>
                </div>
                <h4 className="fw-extrabold mb-0">₹{formatCurrency(data.summary.total_igst)}</h4>
              </div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card border-0 shadow-sm rounded-4 h-100 bg-white border-start border-success border-4">
              <div className="card-body p-3 p-md-4">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <div className="bg-success bg-opacity-10 p-1 px-2 rounded-2 text-success">
                    <i className="fa-solid fa-building small"></i>
                  </div>
                  <h6 className="text-muted small text-uppercase fw-bold mb-0">CGST</h6>
                </div>
                <h4 className="fw-extrabold mb-0">₹{formatCurrency(data.summary.total_cgst)}</h4>
              </div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card border-0 shadow-sm rounded-4 h-100 bg-white border-start border-info border-4">
              <div className="card-body p-3 p-md-4">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <div className="bg-info bg-opacity-10 p-1 px-2 rounded-2 text-info">
                    <i className="fa-solid fa-landmark small"></i>
                  </div>
                  <h6 className="text-muted small text-uppercase fw-bold mb-0">SGST</h6>
                </div>
                <h4 className="fw-extrabold mb-0">₹{formatCurrency(data.summary.total_sgst)}</h4>
              </div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card border-0 shadow-sm rounded-4 h-100 bg-dark bg-gradient text-white">
              <div className="card-body p-3 p-md-4">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <div className="bg-white bg-opacity-20 p-1 px-2 rounded-2 text-white">
                    <i className="fa-solid fa-coins small"></i>
                  </div>
                  <h6 className="text-white-50 small text-uppercase fw-bold mb-0">Grand Total</h6>
                </div>
                <h4 className="fw-extrabold mb-0 text-warning">₹{formatCurrency(data.summary.grand_total_gst)}</h4>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Table - Desktop */}
      <div className="d-none d-lg-block card border-0 shadow-sm rounded-4 overflow-hidden mb-5">
        <div className="table-responsive" style={{ maxHeight: "700px" }}>
          <table className="table align-middle mb-0">
            <thead className="table-light sticky-top" style={{ zIndex: 10 }}>
              <tr className="small text-uppercase fw-bold text-secondary">
                <th className="ps-4 py-3">Details</th>
                <th className="py-3">Transaction Info</th>
                <th className="py-3">Tag / HSN</th>
                <th className="py-3 text-end">Rate (₹)</th>
                <th className="py-3 text-center">GST % / Type</th>
                <th className="py-3 text-end">IGST</th>
                <th className="py-3 text-end">CGST</th>
                <th className="py-3 text-end">SGST</th>
                <th className="py-3 text-end pe-4">Total GST (₹)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="text-center py-5">
                    <div className="spinner-border text-primary mb-2" />
                    <p className="text-muted mb-0">Loading data...</p>
                  </td>
                </tr>
              ) : !data || groupedData.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-5 text-muted">
                    <i className="fa-regular fa-folder-open fa-3x mb-3 opacity-25"></i>
                    <p className="fw-medium mb-0">No records found for this period</p>
                  </td>
                </tr>
              ) : (
                groupedData.map((group, gIdx) => (
                  <React.Fragment key={gIdx}>
                    <tr className="table-light border-top border-primary border-3">
                      <td colSpan="5" className="ps-4 py-3">
                        <div className="d-flex align-items-center gap-3">
                          <div className="bg-primary bg-opacity-10 p-2 rounded-3 text-primary shadow-sm">
                            <i className="fa-solid fa-box-open fa-lg"></i>
                          </div>
                          <div>
                            <h6 className="fw-bold mb-0 text-dark">{group.product_name}</h6>
                            <span className="text-muted small">
                              HSN: <span className="fw-medium text-dark">{group.hsn_sac_code || "—"}</span> 
                              {" • "} 
                              GST: <span className="fw-medium text-dark">{group.gst_percentage}%</span>
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-end fw-bold">₹{formatCurrency(group.totals.igst)}</td>
                      <td className="py-3 text-end fw-bold">₹{formatCurrency(group.totals.cgst)}</td>
                      <td className="py-3 text-end fw-bold">₹{formatCurrency(group.totals.sgst)}</td>
                      <td className="py-3 text-end pe-4 fw-bold text-primary">₹{formatCurrency(group.totals.total_gst)}</td>
                    </tr>
                    
                    {group.transactions.map((p, idx) => (
                      <tr key={`${gIdx}-${idx}`} className="small hover-bg-light animate__animated animate__fadeIn">
                        <td className="ps-5 py-2 text-muted italic">
                          <i className="fa-solid fa-arrow-turn-up fa-rotate-90 me-2 opacity-25"></i>
                          {p.transaction_date}
                        </td>
                        <td className="py-2">
                          <span className="fw-bold text-dark">{p.invoice_number}</span>
                        </td>
                        <td className="py-2">
                          {p.product_tag ? (
                            <span className="badge bg-light text-secondary border rounded-pill fw-normal">
                              {p.product_tag}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="py-2 text-end">₹{formatCurrency(p.rate)}</td>
                        <td className="py-2 text-center">
                          <span className={`badge ${p.igst_amount > 0 ? "bg-warning text-dark" : "bg-info text-dark"} bg-opacity-10 fw-medium border border-opacity-25`}>
                            {p.igst_amount > 0 ? "IGST" : "CGST+SGST"}
                          </span>
                        </td>
                        <td className="py-2 text-end text-muted">{p.igst_amount > 0 ? `₹${formatCurrency(p.igst_amount)}` : "—"}</td>
                        <td className="py-2 text-end text-muted">{p.cgst_amount > 0 ? `₹${formatCurrency(p.cgst_amount)}` : "—"}</td>
                        <td className="py-2 text-end text-muted">{p.sgst_amount > 0 ? `₹${formatCurrency(p.sgst_amount)}` : "—"}</td>
                        <td className="py-2 text-end pe-4 fw-bold">₹{formatCurrency(p.total_gst_amount)}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
            {data && data.products.length > 0 && (
              <tfoot className="table-dark fw-bold border-top-0">
                <tr>
                  <td colSpan="5" className="text-end ps-4 py-3 pe-4 text-uppercase tracking-wider">Overall Grand Totals:</td>
                  <td className="py-3 text-end">₹{formatCurrency(data.summary.total_igst)}</td>
                  <td className="py-3 text-end">₹{formatCurrency(data.summary.total_cgst)}</td>
                  <td className="py-3 text-end">₹{formatCurrency(data.summary.total_sgst)}</td>
                  <td className="py-3 text-end pe-4 text-warning">₹{formatCurrency(data.summary.grand_total_gst)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="d-lg-none mb-5 pb-5">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" />
          </div>
        ) : groupedData.length === 0 ? (
          <div className="card border-0 shadow-sm rounded-4 p-5 text-center text-muted">
            <i className="fa-regular fa-folder-open fa-3x mb-3 opacity-25"></i>
            <p className="fw-medium mb-0">No records found</p>
          </div>
        ) : (
          groupedData.map((group, gIdx) => (
            <div key={gIdx} className="card border-0 shadow-sm rounded-4 mb-3 overflow-hidden border-start border-primary border-4">
              <div className="card-header bg-light py-3 border-0">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <h6 className="fw-bold mb-1">{group.product_name}</h6>
                    <div className="d-flex flex-wrap gap-2">
                      <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill small">HSN: {group.hsn_sac_code || "—"}</span>
                      <span className="badge bg-secondary bg-opacity-10 text-secondary rounded-pill small">GST: {group.gst_percentage}%</span>
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="text-muted small fw-bold text-uppercase">Total Tax</div>
                    <div className="h5 fw-bold text-primary mb-0">₹{formatCurrency(group.totals.total_gst)}</div>
                  </div>
                </div>
              </div>
              <div className="card-body p-0">
                <div className="list-group list-group-flush">
                  {group.transactions.map((p, idx) => (
                    <div key={idx} className="list-group-item border-0 border-bottom p-3">
                      <div className="d-flex justify-content-between mb-2">
                        <span className="fw-bold text-dark">{p.invoice_number}</span>
                        <span className="text-muted small">{p.transaction_date}</span>
                      </div>
                      <div className="row g-2 small">
                        <div className="col-6">
                          <div className="text-muted">Base Rate</div>
                          <div className="fw-medium">₹{formatCurrency(p.rate)}</div>
                        </div>
                        <div className="col-6 text-end">
                          <div className="text-muted">Tax Amount</div>
                          <div className="fw-bold text-dark">₹{formatCurrency(p.total_gst_amount)}</div>
                        </div>
                        <div className="col-12">
                          <div className="d-flex justify-content-between align-items-center mt-1 p-2 bg-light rounded-3">
                            <span className="text-muted small fw-bold">{p.igst_amount > 0 ? "IGST" : "CGST+SGST"}</span>
                            <div className="d-flex gap-2 text-dark">
                              {p.igst_amount > 0 ? (
                                <span>₹{formatCurrency(p.igst_amount)}</span>
                              ) : (
                                <>
                                  <span>C: ₹{formatCurrency(p.cgst_amount)}</span>
                                  <span className="text-muted">|</span>
                                  <span>S: ₹{formatCurrency(p.sgst_amount)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Sticky Mobile Summary */}
      {data && data.products.length > 0 && (
        <div className="d-lg-none fixed-bottom bg-dark text-white p-3 shadow-lg border-top border-warning border-3 animate__animated animate__slideInUp" style={{ zIndex: 1050 }}>
          <div className="container">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <div className="text-white-50 small text-uppercase fw-bold" style={{ fontSize: '0.6rem' }}>Grand Total GST</div>
                <div className="h4 mb-0 text-warning fw-extrabold">₹{formatCurrency(data.summary.grand_total_gst)}</div>
              </div>
              <button 
                className="btn btn-warning btn-sm rounded-pill px-3 fw-bold shadow-sm"
                onClick={handleExport}
              >
                <i className="fa-solid fa-file-export me-1"></i> Export
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .duration-pills-wrapper {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 5px;
          scrollbar-width: none;
        }
        .duration-pills-wrapper::-webkit-scrollbar { display: none; }
        
        .fw-extrabold { font-weight: 800; }
        .hover-bg-light:hover { background-color: #f8faff !important; }
        .italic { font-style: italic; }
        .tracking-wider { letter-spacing: 0.05em; }
        
        @media (max-width: 768px) {
          .card-body { padding: 1rem !important; }
          .h4 { font-size: 1.1rem; }
        }
      `}</style>
    </div>
  );
}
