

import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, Filler,
} from "chart.js";
import api from "../utils/api";
import PageHeader from "../components/shared/PageHeader";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { formatIndiaDate } from "../utils/time";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, Filler
);

const PRESETS = [
  { value: "today",          label: "Today" },
  { value: "yesterday",      label: "Yesterday" },
  { value: "last_week",      label: "Last 7 Days" },
  { value: "this_month",     label: "This Month" },
  { value: "last_month",     label: "Last Month" },
  { value: "last_quarter",   label: "Last 3 Months" },
  { value: "last_half_year", label: "Last 6 Months" },
  { value: "this_year",      label: "This Year" },
];

function formatCurrency(n) {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
}

function formatDate(str) {
  if (!str) return "";
  return formatIndiaDate(str, { year: undefined });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [preset, setPreset] = useState("this_month");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await api.get(`/dashboard?preset=${preset}`);
        setData(res.data.data);
      } catch {
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [preset]);

  
  if (user?.is_platform_admin) {
    return <Navigate to="/admin" replace />;
  }

  const kpiCards = data
    ? [
        { label: "Total Sales", value: data.sales.total, count: data.sales.count, icon: "fa-solid fa-indian-rupee-sign", color: "#10b981", bg: "rgba(16,185,129,0.1)" },
        { label: "Total Purchases", value: data.purchases.total, count: data.purchases.count, icon: "fa-solid fa-cart-shopping", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
        { label: "Receivables", value: data.receivables.total, count: data.receivables.count, icon: "fa-solid fa-arrow-down", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
        { label: "Payables", value: data.payables.total, count: data.payables.count, icon: "fa-solid fa-arrow-up", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
      ]
    : [];

  const chartData = data?.salesChart
    ? {
        labels: data.salesChart.map((d) => formatDate(d.day)),
        datasets: [
          {
            label: "Sales (₹)",
            data: data.salesChart.map((d) => d.sales),
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59,130,246,0.15)",
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointBackgroundColor: "#3b82f6",
          },
        ],
      }
    : null;

  return (
    <div className="dashboard-page fade-in">
      <PageHeader title="Dashboard" icon="fa-solid fa-gauge-high">
        <select
          className="form-select form-select-sm"
          style={{ width: "160px" }}
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
          id="dashboard-preset"
        >
          {PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </PageHeader>

      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary" />
        </div>
      ) : (
        <>
          {}
          <div className="row g-3 mb-4">
            {kpiCards.map((kpi) => (
              <div key={kpi.label} className="col-6 col-lg-3">
                <div className="kpi-card">
                  <div className="kpi-icon" style={{ background: kpi.bg, color: kpi.color }}>
                    <i className={kpi.icon}></i>
                  </div>
                  <div className="kpi-body">
                    <div className="kpi-label">{kpi.label}</div>
                    <div className="kpi-value" style={{ color: kpi.color }}>
                      ₹{formatCurrency(kpi.value)}
                    </div>
                    <div className="kpi-count">{kpi.count} records</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {}
          <div className="row g-3 mb-4">
            {}
            <div className="col-12 col-lg-8">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-transparent border-0 fw-semibold small">
                  <i className="fa-solid fa-chart-line me-2 text-primary"></i>Sales Trend
                </div>
                <div className="card-body">
                  {chartData && chartData.labels.length > 0 ? (
                    <Line
                      data={chartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                          y: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.05)" } },
                          x: { grid: { display: false } },
                        },
                      }}
                      height={250}
                    />
                  ) : (
                    <div className="text-center text-muted py-5">
                      <i className="fa-solid fa-chart-line fa-3x mb-3 opacity-25"></i>
                      <p>No sales data for this period</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {}
            <div className="col-12 col-lg-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-transparent border-0 fw-semibold small">
                  <i className="fa-solid fa-trophy me-2 text-warning"></i>Top Products
                </div>
                <div className="card-body p-0">
                  {data?.topProducts?.length > 0 ? (
                    <div className="list-group list-group-flush">
                      {data.topProducts.map((p, i) => (
                        <div key={i} className="list-group-item bg-transparent d-flex justify-content-between align-items-center py-2 px-3">
                          <div>
                            <span className="badge bg-primary bg-opacity-10 text-primary me-2 rounded-pill" style={{ width: "22px" }}>{i + 1}</span>
                            <span className="small">{p.name}</span>
                          </div>
                          <span className="small fw-semibold">₹{formatCurrency(p.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted py-4 small">No data</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {}
          <div className="row g-3">
            <div className="col-12 col-lg-6">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-transparent border-0 d-flex justify-content-between align-items-center">
                  <span className="fw-semibold small">
                    <i className="fa-solid fa-file-invoice me-2 text-primary"></i>Recent Invoices
                  </span>
                  <button className="btn btn-link btn-sm p-0 text-primary" onClick={() => navigate("/invoices")}>View All</button>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-sm table-hover mb-0">
                      <tbody>
                        {data?.recentInvoices?.map((inv) => (
                          <tr key={inv.id} className="cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}/view`)}>
                            <td className="small fw-medium">{inv.code}</td>
                            <td className="small text-muted">{inv.customer_name}</td>
                            <td className="small text-end">₹{formatCurrency(inv.grand_total)}</td>
                            <td className="text-end">
                              <span className={`badge bg-${inv.status === "PAID" ? "success" : inv.status === "PARTIAL" ? "warning" : "danger"} bg-opacity-10 text-${inv.status === "PAID" ? "success" : inv.status === "PARTIAL" ? "warning" : "danger"}`} style={{ fontSize: "0.7rem" }}>
                                {inv.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {(!data?.recentInvoices || data.recentInvoices.length === 0) && (
                          <tr><td colSpan="4" className="text-center text-muted small py-3">No invoices yet</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-12 col-lg-6">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-transparent border-0 d-flex justify-content-between align-items-center">
                  <span className="fw-semibold small">
                    <i className="fa-solid fa-file-invoice-dollar me-2 text-warning"></i>Recent Bills
                  </span>
                  <button className="btn btn-link btn-sm p-0 text-primary" onClick={() => navigate("/bills")}>View All</button>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-sm table-hover mb-0">
                      <tbody>
                        {data?.recentBills?.map((bill) => (
                          <tr key={bill.id} className="cursor-pointer" onClick={() => navigate(`/bills/${bill.id}/edit`)}>
                            <td className="small fw-medium">{bill.code}</td>
                            <td className="small text-muted">{bill.vendor_name}</td>
                            <td className="small text-end">₹{formatCurrency(bill.grand_total)}</td>
                            <td className="text-end">
                              <span className={`badge bg-${bill.status === "PAID" ? "success" : bill.status === "PARTIAL" ? "warning" : "danger"} bg-opacity-10 text-${bill.status === "PAID" ? "success" : bill.status === "PARTIAL" ? "warning" : "danger"}`} style={{ fontSize: "0.7rem" }}>
                                {bill.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {(!data?.recentBills || data.recentBills.length === 0) && (
                          <tr><td colSpan="4" className="text-center text-muted small py-3">No bills yet</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
