import React, { useEffect, useMemo, useRef, useState, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import AuthImage from "../../components/shared/AuthImage";
import { toast } from "react-toastify";
import PageHeader from "../../components/shared/PageHeader";
import PhoneInput from "../../components/shared/PhoneInput";
import api from "../../utils/api";
import { formatIndiaDateTime } from "../../utils/time";

function formatDateTime(value) {
  return formatIndiaDateTime(value) || "-";
}

function formatStorage(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function statusBadgeClass(status) {
  switch (status) {
    case "ACTIVE":
    case "APPROVED":
      return "bg-success-subtle text-success-emphasis";
    case "PENDING":
      return "bg-warning-subtle text-warning-emphasis";
    case "REJECTED":
    case "EXPIRED":
      return "bg-danger-subtle text-danger-emphasis";
    default:
      return "bg-secondary-subtle text-secondary-emphasis";
  }
}

export default function AdminPanel() {
  const [companies, setCompanies] = useState([]);
  const [payments, setPayments] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [planSelections, setPlanSelections] = useState({});
  const [expandedCompanies, setExpandedCompanies] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [qrImageUrl, setQrImageUrl] = useState(null);
  const [upiId, setUpiId] = useState("");
  const [upiMobile, setUpiMobile] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [qrUploading, setQrUploading] = useState(false);
  const qrFileInputRef = useRef(null);
  const [viewingProof, setViewingProof] = useState(null);

  async function handleViewProof(screenshotPath) {
    if (viewingProof) return;
    setViewingProof(screenshotPath);
    try {
      const token = localStorage.getItem("trihub_token");
      const baseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/api$/, "");
      const fetchUrl = `${baseUrl}${screenshotPath}`;
      const res = await fetch(fetchUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load proof");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
    } catch {
      toast.error("Failed to load payment proof");
    } finally {
      setViewingProof(null);
    }
  }

  async function loadAdminData() {
    setLoading(true);
    try {
      const [companiesRes, paymentsRes, feedbacksRes] = await Promise.all([
        api.get("/admin/companies"),
        api.get("/admin/payments"),
        api.get("/admin/feedbacks"),
      ]);

      const nextCompanies = companiesRes.data.data || [];
      setCompanies(nextCompanies);
      setPayments(paymentsRes.data.data || []);
      setFeedbacks(feedbacksRes.data.data || []);
      setPlanSelections((current) => {
        const next = { ...current };
        nextCompanies.forEach((company) => {
          if (!next[company.company_id]) {
            next[company.company_id] =
              company.sub_plan === "YEARLY" || company.sub_plan === "MONTHLY"
                ? company.sub_plan
                : "MONTHLY";
          }
        });
        return next;
      });
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to load admin dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdminData();
    loadQrImage();
  }, []);

  async function loadQrImage() {
    try {
      const res = await api.get("/admin/payment-qr");
      const data = res.data?.data || {};
      setQrImageUrl(data.qr_image_url || null);
      setUpiId(data.upi_id || "");
      setUpiMobile(data.upi_mobile || "");
    } catch {
    }
  }

  async function handleSaveDetails() {
    setSavingDetails(true);
    try {
      await api.post("/admin/payment-details", {
        upi_id: upiId,
        upi_mobile: upiMobile,
      });
      toast.success("Payment details saved successfully");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to save payment details");
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleQrUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setQrUploading(true);
    try {
      const formData = new FormData();
      formData.append("qr_image", file);
      const res = await api.post("/admin/payment-qr", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setQrImageUrl(res.data?.data?.qr_image_url || null);
      toast.success(res.data?.message || "QR code uploaded successfully");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to upload QR code");
    } finally {
      setQrUploading(false);
      if (qrFileInputRef.current) qrFileInputRef.current.value = "";
    }
  }

  async function handleQrDelete() {
    if (!window.confirm("Remove the payment QR code? Master users will not see a QR on the subscription page.")) {
      return;
    }

    setQrUploading(true);
    try {
      await api.delete("/admin/payment-qr");
      setQrImageUrl(null);
      toast.success("Payment QR code removed");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to remove QR code");
    } finally {
      setQrUploading(false);
    }
  }

  const stats = useMemo(() => {
    const total = companies.length;
    const active = companies.filter((company) => company.sub_status === "ACTIVE").length;
    const onTrial = companies.filter((company) => company.sub_plan === "TRIAL" && company.sub_status === "ACTIVE").length;
    const expired = companies.filter((company) => company.sub_status === "EXPIRED").length;
    const pendingPayments = payments.filter((payment) => payment.status === "PENDING").length;
    const totalFeedbacks = feedbacks.length;

    return { total, active, onTrial, expired, pendingPayments, totalFeedbacks };
  }, [companies, payments, feedbacks]);

  const categorizedCompanies = useMemo(() => {
    return {
      TRIAL: companies.filter((c) => c.sub_plan === "TRIAL"),
      MONTHLY: companies.filter((c) => c.sub_plan === "MONTHLY"),
      YEARLY: companies.filter((c) => c.sub_plan === "YEARLY"),
    };
  }, [companies]);

  const toggleCompanyExpand = (companyId) => {
    setExpandedCompanies((prev) => ({
      ...prev,
      [companyId]: !prev[companyId],
    }));
  };

  async function handleActivate(companyId) {
    const plan = planSelections[companyId] || "MONTHLY";
    const companyData = companies.find((c) => c.company_id === companyId);
    const memberCount = companyData?.users?.filter((u) => u.role !== "MASTER").length || 0;
    const confirmMsg = memberCount > 0
      ? `Activate subscription on ${plan} plan?\n\nThis will also re-enable ${memberCount} team member${memberCount !== 1 ? "s" : ""} under this company.`
      : `Activate subscription on ${plan} plan?`;
    if (!window.confirm(confirmMsg)) return;

    const busyId = `activate-${companyId}`;
    setBusyKey(busyId);
    try {
      await api.patch(`/admin/companies/${companyId}/activate`, { plan });
      toast.success(`Subscription activated on ${plan.toLowerCase()} plan. All team members have been re-enabled.`);
      await loadAdminData();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to activate subscription");
    } finally {
      setBusyKey("");
    }
  }

  async function handleSuspend(companyId) {
    const companyData = companies.find((c) => c.company_id === companyId);
    const memberCount = companyData?.users?.filter((u) => u.role !== "MASTER").length || 0;
    const confirmMsg = memberCount > 0
      ? `Suspend this company subscription?\n\nThis will deactivate ${memberCount} team member${memberCount !== 1 ? "s" : ""} under this company. Their data will be preserved.`
      : "Suspend this company subscription?";
    if (!window.confirm(confirmMsg)) return;

    const busyId = `suspend-${companyId}`;
    setBusyKey(busyId);
    try {
      await api.patch(`/admin/companies/${companyId}/suspend`, {});
      toast.success("Subscription suspended. All team members have been deactivated.");
      await loadAdminData();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to suspend subscription");
    } finally {
      setBusyKey("");
    }
  }

  async function handleApprove(paymentId) {
    const adminNotes = window.prompt("Optional approval note", "") ?? "";
    const busyId = `approve-${paymentId}`;
    setBusyKey(busyId);
    try {
      await api.patch(`/admin/payments/${paymentId}/approve`, {
        admin_notes: adminNotes,
      });
      toast.success("Payment approved and subscription activated");
      await loadAdminData();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to approve payment");
    } finally {
      setBusyKey("");
    }
  }

  async function handleReject(paymentId) {
    const reason = window.prompt("Reason for rejection");
    if (!reason) {
      return;
    }

    const busyId = `reject-${paymentId}`;
    setBusyKey(busyId);
    try {
      await api.patch(`/admin/payments/${paymentId}/reject`, {
        admin_notes: reason,
      });
      toast.success("Payment request rejected");
      await loadAdminData();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to reject payment");
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div className="admin-panel-page">
      <PageHeader
        title="Platform Admin"
        subtitle="Review tenant access, subscriptions, and pending payment proofs."
        icon="fa-solid fa-shield-halved"
      />

      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="admin-stat-card">
            <span className="admin-stat-label">Total companies</span>
            <strong>{stats.total}</strong>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="admin-stat-card">
            <span className="admin-stat-label">Active</span>
            <strong>{stats.active}</strong>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="admin-stat-card">
            <span className="admin-stat-label">On trial</span>
            <strong>{stats.onTrial}</strong>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="admin-stat-card">
            <span className="admin-stat-label">Expired</span>
            <strong>{stats.expired}</strong>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
            <div>
              <h3 className="h6 mb-1">
                <i className="fa-solid fa-qrcode me-2"></i>Payment QR Code
              </h3>
              <p className="text-muted mb-0 small">
                Upload a UPI QR code that master users will see on the subscription page to make payments.
              </p>
            </div>
          </div>

          <div className="row g-3 align-items-center">
            <div className="col-12 col-md-4 text-center">
              {qrImageUrl ? (
                <div>
                  <AuthImage
                    src={qrImageUrl}
                    alt="Payment QR Code"
                    style={{
                      maxWidth: 220,
                      maxHeight: 220,
                      borderRadius: 12,
                      border: "2px solid var(--bs-border-color)",
                      padding: 8,
                      background: "#fff",
                    }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    width: 220,
                    height: 220,
                    borderRadius: 12,
                    border: "2px dashed var(--bs-border-color)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto",
                    color: "var(--bs-secondary-color)",
                    gap: 8,
                  }}
                >
                  <i className="fa-solid fa-qrcode" style={{ fontSize: 48, opacity: 0.3 }}></i>
                  <span className="small">No QR uploaded</span>
                </div>
              )}
            </div>

            <div className="col-12 col-md-8">
              <div className="row g-3 mb-3">
                <div className="col-12 col-sm-6">
                  <label className="form-label small fw-medium">Upload QR code image</label>
                  <input
                    ref={qrFileInputRef}
                    type="file"
                    className="form-control"
                    accept="image/*"
                    onChange={handleQrUpload}
                    disabled={qrUploading}
                  />
                  <div className="form-text">Accepted: JPG, PNG, GIF, WebP — Max 5 MB</div>
                </div>
                <div className="col-12 col-sm-6 d-flex align-items-center gap-2 mt-4 mt-sm-0">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    disabled={qrUploading}
                    onClick={() => qrFileInputRef.current?.click()}
                  >
                    <i className="fa-solid fa-upload me-1"></i>
                    {qrImageUrl ? "Replace QR" : "Upload QR"}
                  </button>
                  {qrImageUrl && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      disabled={qrUploading}
                      onClick={handleQrDelete}
                    >
                      <i className="fa-solid fa-trash me-1"></i>Remove
                    </button>
                  )}
                  {qrUploading && (
                    <span className="small text-muted align-self-center">
                      <i className="fa-solid fa-spinner fa-spin me-1"></i>
                    </span>
                  )}
                </div>
              </div>

              <hr className="my-4" />

              <div className="row g-3">
                <div className="col-12 col-sm-6">
                  <label className="form-label small fw-medium">Company UPI ID</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. trihub@okicici"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                  />
                </div>
                <div className="col-12 col-sm-6">
                  <label className="form-label small fw-medium">Company UPI Mobile</label>
                  <PhoneInput
                    value={upiMobile}
                    onChange={(e) => setUpiMobile(e.target.value)}
                  />
                </div>
                <div className="col-12">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={savingDetails}
                    onClick={handleSaveDetails}
                  >
                    {savingDetails ? (
                      <><i className="fa-solid fa-spinner fa-spin me-2"></i>Saving...</>
                    ) : (
                      "Save Details"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div>
              <h3 className="h6 mb-1">Company Accounts</h3>
              <p className="text-muted mb-0 small">Pending payments: {stats.pendingPayments}</p>
            </div>
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={loadAdminData}>
              <i className="fa-solid fa-rotate me-2"></i>Refresh
            </button>
          </div>

          <div className="d-flex flex-column gap-5">
            {Object.entries({
              TRIAL: { label: "Trial Plan", icon: "fa-solid fa-clock", theme: "primary" },
              MONTHLY: { label: "Monthly Subscription", icon: "fa-solid fa-calendar-day", theme: "success" },
              YEARLY: { label: "Yearly Subscription", icon: "fa-solid fa-calendar-check", theme: "info" },
            }).map(([plan, config]) => {
              const items = categorizedCompanies[plan];
              if (items.length === 0) return null;

              return (
                <div key={plan} className="categorized-section">
                  <div className={`d-flex align-items-center gap-2 mb-3 pb-2 border-bottom border-${config.theme} border-opacity-25`}>
                    <div className={`bg-${config.theme} bg-opacity-10 text-${config.theme} rounded p-2`} style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <i className={`${config.icon} fs-5`}></i>
                    </div>
                    <div>
                      <h4 className="h6 mb-0 fw-bold text-uppercase" style={{ letterSpacing: "0.5px" }}>{config.label}</h4>
                      <div className="small text-muted">{items.length} {items.length === 1 ? "company" : "companies"}</div>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="table align-middle admin-table">
                      <thead>
                        <tr>
                          <th>Company</th>
                          <th>Owner</th>
                          <th>Plan</th>
                          <th>Status</th>
                          <th>Trial end</th>
                          <th>Storage</th>
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((company) => (
                          <Fragment key={company.company_id}>
                            <tr>
                              <td>
                                <div className="d-flex align-items-start gap-2">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-link text-decoration-none p-0 text-secondary mt-1"
                                    onClick={() => toggleCompanyExpand(company.company_id)}
                                    title={expandedCompanies[company.company_id] ? "Hide users" : "Show users"}
                                  >
                                    <i className={`fa-solid fa-chevron-${expandedCompanies[company.company_id] ? "down" : "right"}`}></i>
                                  </button>
                                  <div>
                                    <strong>{company.company_name || "Unnamed company"}</strong>
                                    <div className="small text-muted">{company.gstin || "No GSTIN"}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div>{company.owner_name}</div>
                                <div className="small text-muted">{company.owner_email}</div>
                              </td>
                              <td style={{ minWidth: 150 }}>
                                <select
                                  className="form-select form-select-sm"
                                  value={planSelections[company.company_id] || "MONTHLY"}
                                  onChange={(event) =>
                                    setPlanSelections((current) => ({
                                      ...current,
                                      [company.company_id]: event.target.value,
                                    }))
                                  }
                                >
                                  <option value="MONTHLY">Monthly</option>
                                  <option value="YEARLY">Yearly</option>
                                </select>
                                <div className="small text-muted mt-1">Current: {company.sub_plan}</div>
                              </td>
                              <td>
                                <span className={`badge ${statusBadgeClass(company.sub_status)}`}>
                                  {company.sub_status}
                                </span>
                              </td>
                              <td>{formatDateTime(company.trial_ends_at)}</td>
                              <td>{formatStorage(company.storage_used_bytes)}</td>
                              <td className="text-end">
                                <div className="d-flex justify-content-end gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    disabled={busyKey === `activate-${company.company_id}`}
                                    onClick={() => handleActivate(company.company_id)}
                                  >
                                    {busyKey === `activate-${company.company_id}` ? "Saving..." : "Activate"}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    disabled={busyKey === `suspend-${company.company_id}`}
                                    onClick={() => handleSuspend(company.company_id)}
                                  >
                                    {busyKey === `suspend-${company.company_id}` ? "Saving..." : "Suspend"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {expandedCompanies[company.company_id] && (
                              <tr className="bg-light">
                                <td colSpan="7" className="p-4 border-bottom-0 shadow-inner">
                                  <h6 className="mb-3 text-muted fw-bold text-uppercase" style={{ fontSize: "0.75rem", letterSpacing: "0.5px" }}>
                                    Users in this Workspace
                                  </h6>
                                  <div className="d-flex flex-column gap-3">
                                    {company.users && company.users.filter(u => u.role === 'MASTER').map(master => (
                                      <div key={master.id} className="card border-0 shadow-sm">
                                        <div className="card-header bg-white border-bottom-0 d-flex align-items-center gap-3 py-3 rounded">
                                          {master.profile_picture ? (
                                            <AuthImage src={master.profile_picture} alt="Profile" className="rounded-circle shadow-sm" style={{ width: 40, height: 40, objectFit: "cover" }} />
                                          ) : (
                                            <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm" style={{ width: 40, height: 40, fontSize: "1.1rem" }}>
                                              {master.name.charAt(0).toUpperCase()}
                                            </div>
                                          )}
                                          <div className="flex-grow-1">
                                            <div className="fw-bold text-dark">
                                              {master.name}
                                              <span className="badge bg-primary-subtle text-primary-emphasis ms-2" style={{ fontSize: "0.65rem" }}>Master User</span>
                                              <span className={`badge ms-1 ${master.status === 'ACTIVE' ? 'bg-success-subtle text-success-emphasis' : 'bg-danger-subtle text-danger-emphasis'}`} style={{ fontSize: "0.6rem" }}>{master.status || 'ACTIVE'}</span>
                                            </div>
                                            <div className="small text-muted mt-1">
                                              <i className="fa-regular fa-envelope me-1"></i>{master.email}
                                              {master.mobile && <><span className="mx-2">•</span><i className="fa-solid fa-phone me-1"></i>{master.mobile}</>}
                                            </div>
                                          </div>
                                        </div>

                                        {(() => {
                                          const normalUsers = company.users.filter(u => u.role !== 'MASTER' && u.invited_by === master.id);
                                          if (normalUsers.length === 0) return null;

                                          return (
                                            <div className="card-body bg-light border-top p-0 rounded-bottom">
                                              <div className="list-group list-group-flush rounded-bottom">
                                                {normalUsers.map(normal => (
                                                  <div key={normal.id} className="list-group-item bg-transparent d-flex align-items-center gap-3 py-3 ps-5 border-0 border-bottom">
                                                    {normal.profile_picture ? (
                                                      <AuthImage src={normal.profile_picture} alt="Profile" className="rounded-circle shadow-sm" style={{ width: 32, height: 32, objectFit: "cover" }} />
                                                    ) : (
                                                      <div className="bg-secondary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{ width: 32, height: 32, fontSize: "0.85rem" }}>
                                                        {normal.name.charAt(0).toUpperCase()}
                                                      </div>
                                                    )}
                                                    <div>
                                                      <div className="fw-semibold text-dark">
                                                        {normal.name}
                                                        <span className="badge bg-secondary-subtle text-secondary-emphasis ms-2" style={{ fontSize: "0.6rem" }}>{normal.role}</span>
                                                        <span className={`badge ms-1 ${normal.status === 'ACTIVE' ? 'bg-success-subtle text-success-emphasis' : 'bg-danger-subtle text-danger-emphasis'}`} style={{ fontSize: "0.55rem" }}>{normal.status || 'ACTIVE'}</span>
                                                      </div>
                                                      <div className="small text-muted mt-1" style={{ fontSize: "0.75rem" }}>
                                                        <i className="fa-regular fa-envelope me-1"></i>{normal.email}
                                                        {normal.mobile && <><span className="mx-2">•</span><i className="fa-solid fa-phone me-1"></i>{normal.mobile}</>}
                                                      </div>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    ))}
                                    {(!company.users || company.users.filter(u => u.role === 'MASTER').length === 0) && (
                                      <div className="text-muted small">No master users found for this company.</div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="text-center py-5 text-muted">
                <i className="fa-solid fa-spinner fa-spin fs-4 mb-2"></i>
                <div>Loading company accounts...</div>
              </div>
            )}

            {!loading && companies.length === 0 && (
              <div className="text-center py-5 text-muted">
                <i className="fa-solid fa-building-circle-exclamation fs-4 mb-2"></i>
                <div>No company accounts found.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="mb-3">
            <h3 className="h6 mb-1">Payment Requests</h3>
            <p className="text-muted mb-0 small">Approve proofs to activate subscriptions immediately.</p>
          </div>

          <div className="table-responsive">
            <table className="table align-middle admin-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Plan</th>
                  <th>Amount</th>
                  <th>Mode</th>
                  <th>Reference</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="text-center py-4 text-muted">Loading payments...</td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-4 text-muted">No payment requests yet.</td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        <strong>{payment.company_name || payment.owner_name}</strong>
                        <div className="small text-muted">{payment.owner_email}</div>
                      </td>
                      <td>{payment.plan}</td>
                      <td>
                        {new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: "INR",
                        }).format(payment.amount)}
                      </td>
                      <td>
                        <div>{payment.payment_mode}</div>
                        {payment.payer_contact && (
                          <div className="small text-muted">{payment.payer_contact}</div>
                        )}
                      </td>
                      <td>
                        <div>{payment.upi_ref || "-"}</div>
                        {payment.screenshot_path && (
                          <button
                            type="button"
                            className="btn btn-link btn-sm p-0 small"
                            disabled={viewingProof === payment.screenshot_path}
                            onClick={() => handleViewProof(payment.screenshot_path)}
                          >
                            {viewingProof === payment.screenshot_path ? (
                              <><i className="fa-solid fa-spinner fa-spin me-1"></i>Loading...</>
                            ) : (
                              "View proof"
                            )}
                          </button>
                        )}
                      </td>
                      <td>{formatDateTime(payment.created_at)}</td>
                      <td>
                        <span className={`badge ${statusBadgeClass(payment.status)}`}>
                          {payment.status}
                        </span>
                        {payment.admin_notes && (
                          <div className="small text-muted mt-1">{payment.admin_notes}</div>
                        )}
                      </td>
                      <td className="text-end">
                        {payment.status === "PENDING" ? (
                          <div className="d-flex justify-content-end gap-2 flex-wrap">
                            <button
                              type="button"
                              className="btn btn-sm btn-success"
                              disabled={busyKey === `approve-${payment.id}`}
                              onClick={() => handleApprove(payment.id)}
                            >
                              {busyKey === `approve-${payment.id}` ? "Saving..." : "Approve"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              disabled={busyKey === `reject-${payment.id}`}
                              onClick={() => handleReject(payment.id)}
                            >
                              {busyKey === `reject-${payment.id}` ? "Saving..." : "Reject"}
                            </button>
                          </div>
                        ) : (
                          <span className="small text-muted">
                            {payment.reviewed_by_name ? `Reviewed by ${payment.reviewed_by_name}` : "Reviewed"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div>
              <h3 className="h6 mb-1">User Feedback</h3>
              <p className="text-muted mb-0 small">Total feedback received: {stats.totalFeedbacks}</p>
            </div>
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={loadAdminData}>
              <i className="fa-solid fa-rotate me-2"></i>Refresh
            </button>
          </div>

          <div className="table-responsive">
            <table className="table align-middle admin-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>User</th>
                  <th>Rating</th>
                  <th>Comment</th>
                  <th>Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-4 text-muted">Loading feedbacks...</td>
                  </tr>
                ) : feedbacks.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-4 text-muted">No feedbacks received yet.</td>
                  </tr>
                ) : (
                  feedbacks.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="fw-medium">{item.company_name}</span>
                      </td>
                      <td>
                        <div className="fw-medium">{item.user_name}</div>
                        <small className="text-muted">{item.user_email}</small>
                      </td>
                      <td>
                        <div className="text-warning">
                          {[1, 2, 3, 4, 5].map(star => (
                            <i key={star} className={`fa-solid fa-star ${star <= item.rating ? "" : "text-muted opacity-25"}`}></i>
                          ))}
                        </div>
                      </td>
                      <td>
                        <p className="mb-0 text-break" style={{ maxWidth: "400px" }}>
                          {item.comment || <span className="text-muted fst-italic">No comment provided</span>}
                        </p>
                      </td>
                      <td>
                        <small className="text-muted">{formatDateTime(item.created_at)}</small>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
