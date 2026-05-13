import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import BrandLogo from "../../components/shared/BrandLogo";
import { useAuth } from "../../context/AuthContext";
import api from "../../utils/api";
import AuthImage from "../../components/shared/AuthImage";
import { hasPermission } from "../../utils/permissions";
import { formatIndiaDate, formatIndiaDateTime } from "../../utils/time";

function formatPrice(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

const FALLBACK_MONTHLY_PRICE = Number(import.meta.env.VITE_SUBSCRIPTION_MONTHLY_PRICE || 699);
const FALLBACK_YEARLY_PRICE = Number(import.meta.env.VITE_SUBSCRIPTION_YEARLY_PRICE || 6999);

const PLAN_OPTIONS = [
  {
    id: "MONTHLY",
    name: "Monthly",
    amount: FALLBACK_MONTHLY_PRICE,
    description: "Keep the workspace active with flexible monthly renewal.",
  },
  {
    id: "YEARLY",
    name: "Yearly",
    amount: FALLBACK_YEARLY_PRICE,
    description: "Lower yearly cost for businesses that want uninterrupted billing.",
    highlight: true,
  },
];

const PLAN_PERIOD_LABELS = {
  TRIAL: "7-day free trial",
  MONTHLY: "30 days (Monthly)",
  YEARLY: "365 days (Yearly)",
};

function getSubscriptionDaysInfo(subEndsAt) {
  if (!subEndsAt) return null;
  const end = new Date(subEndsAt);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays > 0) return { label: `${diffDays} day${diffDays !== 1 ? "s" : ""} remaining`, expired: false, days: diffDays };
  const agoMs = now.getTime() - end.getTime();
  const agoDays = Math.floor(agoMs / (1000 * 60 * 60 * 24));
  return { label: `Expired ${agoDays} day${agoDays !== 1 ? "s" : ""} ago`, expired: true, days: agoDays };
}

const FEEDBACK_STORAGE_KEY = "trihub_subscription_feedback";

export default function Subscribe() {
  const navigate = useNavigate();
  const {
    user,
    latestPaymentRequest,
    logout,
    refreshSubscription,
  } = useAuth();

  const supportEmail = import.meta.env.VITE_SUBSCRIPTION_SUPPORT_EMAIL?.trim() || "support@trihubtechnologies.com";
  const supportPhone = import.meta.env.VITE_SUBSCRIPTION_SUPPORT_PHONE?.trim() || "Support team";
  const merchantUpiId = import.meta.env.VITE_SUBSCRIPTION_UPI_ID?.trim() || "";
  const merchantName = import.meta.env.VITE_SUBSCRIPTION_PAYEE_NAME?.trim() || "TriHub Billing";
  const envQrImage = import.meta.env.VITE_SUBSCRIPTION_UPI_QR_IMAGE?.trim() || "";
  const [subscriptionQrImage, setSubscriptionQrImage] = useState(envQrImage);
  const [fetchedUpiId, setFetchedUpiId] = useState("");
  const [fetchedUpiMobile, setFetchedUpiMobile] = useState("");

  const [selectedPlan, setSelectedPlan] = useState("YEARLY");
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ rating: 0, comment: "" });
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    plan: "YEARLY",
    payment_mode: "UPI",
    payer_contact: "",
    upi_ref: "",
    screenshot: null,
  });

  const canManageSubscription = hasPermission(user, "can_edit_company");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(FEEDBACK_STORAGE_KEY);
      if (stored) {
        setFeedback(JSON.parse(stored));
      }
    } catch {
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(feedback));
  }, [feedback]);

  async function submitFeedback() {
    if (feedback.rating === 0) {
      toast.error("Please select a rating before submitting");
      return;
    }
    
    setSubmittingFeedback(true);
    try {
      await api.post("/subscription/feedback", {
        rating: feedback.rating,
        comment: feedback.comment
      });
      toast.success("Feedback submitted successfully");
      localStorage.removeItem(FEEDBACK_STORAGE_KEY);
      setFeedback({ rating: 0, comment: "" });
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to submit feedback");
    } finally {
      setSubmittingFeedback(false);
    }
  }

  useEffect(() => {
    setPaymentForm((current) => ({ ...current, plan: selectedPlan }));
  }, [selectedPlan]);

  useEffect(() => {
    async function fetchPaymentDetails() {
      try {
        const res = await api.get("/admin/payment-qr");
        const data = res.data?.data || {};
        if (data.qr_image_url) {
          setSubscriptionQrImage(data.qr_image_url);
        }
        if (data.upi_id) {
          setFetchedUpiId(data.upi_id);
        }
        if (data.upi_mobile) {
          setFetchedUpiMobile(data.upi_mobile);
        }
        
      } catch (error) {
      }
    }
    fetchPaymentDetails();
  }, []);

  const trialEndDate = user?.trial_ends_at
    ? formatIndiaDate(user.trial_ends_at)
    : null;

  const subEndDate = user?.sub_ends_at
    ? formatIndiaDate(user.sub_ends_at)
    : null;

  const daysInfo = getSubscriptionDaysInfo(user?.sub_ends_at || user?.trial_ends_at);
  const periodLabel = PLAN_PERIOD_LABELS[user?.sub_plan] || user?.sub_plan || "Not active";

  const latestStatus = latestPaymentRequest?.status || "";
  const latestSubmittedAt = latestPaymentRequest?.created_at
    ? formatIndiaDateTime(latestPaymentRequest.created_at)
    : null;

  async function handleSubmitPayment(event) {
    event.preventDefault();
    if (!user) {
      toast.error("Sign in first to submit a payment request.");
      return;
    }

    if (paymentForm.payment_mode === "UPI" && !paymentForm.upi_ref.trim()) {
      toast.error("Enter the UPI transaction ID before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("plan", paymentForm.plan);
      formData.append("payment_mode", paymentForm.payment_mode);
      formData.append("payer_contact", paymentForm.payer_contact);
      formData.append("upi_ref", paymentForm.upi_ref);
      if (paymentForm.screenshot) {
        formData.append("screenshot", paymentForm.screenshot);
      }

      const res = await api.post("/subscription/payment-request", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      await refreshSubscription();
      toast.success(res.data.message || "Payment submitted successfully.");
      setShowPaymentForm(false);
      setPaymentForm((current) => ({
        ...current,
        payer_contact: "",
        upi_ref: "",
        screenshot: null,
      }));
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to submit payment request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-wrapper auth-shell subscribe-shell">
      <div className="subscribe-shell-inner">
        <section className="subscribe-hero">
          <span className="auth-kicker">Subscription desk</span>
          <BrandLogo tone="light" size="lg" stacked className="auth-brand" />
          <h1 className="subscribe-title">
            {user?.sub_status === "EXPIRED"
              ? "Your trial has ended, but your workspace and data are still safe."
              : "Keep your TriHub workspace active."}
          </h1>
          <p className="subscribe-copy">
            Share a quick experience rating, choose a plan, and submit your payment proof for activation.
          </p>

          <div className="subscribe-status-card">
            <div className="subscribe-status-top">
              <div>
                <span className={`subscribe-status-badge ${user?.sub_status === "EXPIRED" ? "expired" : "active"}`}>
                  {user?.sub_status === "EXPIRED" ? "Expired" : user?.sub_status || "Guest"}
                </span>
                <h2 className="subscribe-status-title">
                  {user?.sub_status === "ACTIVE" && user?.sub_plan !== "TRIAL"
                    ? `${user?.name ? `${user.name}, your` : "Your"} subscription is active.`
                    : user?.sub_status === "ACTIVE" && user?.sub_plan === "TRIAL"
                    ? `${user?.name ? `${user.name}, your` : "Your"} trial is active.`
                    : user?.name
                    ? `${user.name}, your account is waiting for activation.`
                    : "Your account is waiting for activation."}
                </h2>
              </div>
              {trialEndDate && (user?.sub_plan === "TRIAL" || user?.sub_status === "EXPIRED") && (
                <div className="subscribe-status-date">Trial ended: {trialEndDate}</div>
              )}
            </div>

            <div className="subscribe-status-grid">
              <div>
                <strong>Current plan</strong>
                <span>{periodLabel}</span>
              </div>
              <div>
                <strong>Period ends</strong>
                <span>{subEndDate || trialEndDate || "-"}</span>
              </div>
              <div>
                <strong>Status</strong>
                <span>
                  {daysInfo
                    ? <span style={{ color: daysInfo.expired ? "#f87171" : "#34d399", fontWeight: 600 }}>{daysInfo.label}</span>
                    : (latestStatus || "No submission yet")}
                </span>
              </div>
              <div>
                <strong>Latest payment</strong>
                <span>{latestStatus || "No submission yet"}</span>
              </div>
              <div>
                <strong>Support</strong>
                <span style={{ wordBreak: "break-all" }}>{supportEmail}</span>
              </div>
            </div>
          </div>
        </section>

        {!canManageSubscription ? (
          <section className="subscribe-content text-center py-5">
            <div className="subscribe-alert-card rejected mb-4 d-inline-flex mx-auto" style={{ maxWidth: '480px', textAlign: 'left' }}>
              <div className="subscribe-alert-icon">
                <i className="fa-solid fa-lock"></i>
              </div>
              <div>
                <h3 className="h6 mb-1">Account Deactivated</h3>
                <p className="mb-1 text-muted small">
                  Your account has been deactivated because the workspace subscription has expired.
                  All team member accounts are temporarily disabled until the subscription is renewed.
                </p>
                <p className="mb-0 text-muted small">
                  <strong>What to do:</strong> Contact your workspace administrator (Master user) and ask them to renew the subscription.
                  Once the admin approves the payment, your account will be automatically re-activated.
                </p>
                {daysInfo?.expired && (
                  <p className="mb-0 mt-2 small" style={{ color: 'var(--bs-danger)' }}>
                    <i className="fa-solid fa-clock me-1"></i>{daysInfo.label}
                  </p>
                )}
              </div>
            </div>
            <div>
              {user && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                >
                  <i className="fa-solid fa-arrow-right-from-bracket me-2"></i>Sign out
                </button>
              )}
            </div>
          </section>
        ) : (
          <section className="subscribe-content">
            <div className="subscribe-feedback-card">
              <div>
                <h3>How was your experience?</h3>
                <p className="mb-0 text-muted">Send your feedback directly to the platform admin.</p>
              </div>
              <div className="subscribe-stars" role="group" aria-label="Experience rating">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`subscribe-star ${feedback.rating >= star ? "active" : ""}`}
                    onClick={() => setFeedback((current) => ({ ...current, rating: star }))}
                  >
                    <i className="fa-solid fa-star"></i>
                  </button>
                ))}
              </div>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Tell us what you loved or what we can improve..."
                value={feedback.comment}
                onChange={(event) =>
                  setFeedback((current) => ({ ...current, comment: event.target.value }))
                }
              />
              <div className="d-flex justify-content-end mt-2">
                <button 
                  type="button" 
                  className="btn btn-sm btn-primary" 
                  onClick={submitFeedback}
                  disabled={submittingFeedback || feedback.rating === 0}
                >
                  {submittingFeedback ? <><i className="fa-solid fa-spinner fa-spin me-2"></i>Submitting...</> : "Submit Feedback"}
                </button>
              </div>
            </div>

            <div className="subscribe-plan-grid">
              {PLAN_OPTIONS.map((plan) => (
                <article
                  key={plan.id}
                  className={`subscribe-plan-card ${selectedPlan === plan.id ? "selected" : ""}${plan.highlight ? " popular" : ""}`}
                >
                  <div className="subscribe-plan-head">
                    <span className={`subscribe-plan-badge${plan.highlight ? " popular" : ""}`}>
                      {plan.highlight ? "Best Value" : "Flexible"}
                    </span>
                    <h3>{plan.name}</h3>
                    <p>{plan.description}</p>
                  </div>

                  <div className="subscribe-plan-price">
                    <span className="subscribe-plan-amount">{formatPrice(plan.amount)}</span>
                    <span className="subscribe-plan-period">/{plan.id === "YEARLY" ? "year" : "month"}</span>
                  </div>

                  <button
                    type="button"
                    className={`btn w-100 ${selectedPlan === plan.id ? "btn-primary" : "btn-outline-primary"}`}
                    onClick={() => setSelectedPlan(plan.id)}
                  >
                    {selectedPlan === plan.id ? "Selected" : `Choose ${plan.name}`}
                  </button>
                </article>
              ))}
            </div>

            <div className="row g-4 mt-1">
              <div className="col-12 col-lg-6">
                <div className="subscribe-payment-card h-100">
                  <h3>UPI payment</h3>
                  <p className="text-muted">
                    Scan the official TriHub QR below, then submit your transaction details.
                  </p>

                  <div className="subscribe-qr-panel">
                    {subscriptionQrImage ? (
                      <AuthImage src={subscriptionQrImage} alt="Subscription UPI QR" className="subscribe-qr-image" />
                    ) : (
                      <div className="subscribe-qr-placeholder">
                        <i className="fa-solid fa-qrcode"></i>
                        <span>Add `VITE_SUBSCRIPTION_UPI_QR_IMAGE` to show the payment QR.</span>
                      </div>
                    )}
                  </div>

                  <div className="subscribe-payment-meta">
                    <div>
                      <strong>Payee</strong>
                      <span>{merchantName}</span>
                    </div>
                    <div>
                      <strong>UPI ID</strong>
                      <span className="user-select-all font-monospace">{fetchedUpiId || merchantUpiId || "Not configured"}</span>
                    </div>
                    <div>
                      <strong>UPI Mobile</strong>
                      <span className="user-select-all font-monospace">{fetchedUpiMobile || "Not configured"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-12 col-lg-6">
                <div className="subscribe-payment-card h-100">
                  <h3>Cash payment</h3>
                  <p className="text-muted">
                    Visit the office or contact support, then upload the receipt number or proof so the team can activate your account.
                  </p>

                  <div className="subscribe-cash-note">
                    <i className="fa-solid fa-building-circle-check"></i>
                    <span className="text-break">Need help? Contact {supportPhone} or {supportEmail}.</span>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary mt-auto"
                    onClick={() => setShowPaymentForm((current) => !current)}
                  >
                    <i className="fa-solid fa-receipt me-2"></i>
                    {showPaymentForm ? "Hide payment form" : "I have paid"}
                  </button>
                </div>
              </div>
            </div>

            {showPaymentForm && (
              <div className="subscribe-form-card mt-4">
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
                  <div>
                    <h3 className="mb-1">Submit payment proof</h3>
                    <p className="text-muted mb-0">Our team will verify and activate your account within 24 hours.</p>
                  </div>
                  <span className="badge bg-primary-subtle text-primary-emphasis">
                    {selectedPlan} · {formatPrice(PLAN_OPTIONS.find((plan) => plan.id === paymentForm.plan)?.amount || 0)}
                  </span>
                </div>

                <form onSubmit={handleSubmitPayment}>
                  <div className="row g-3">
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-medium">Plan</label>
                      <select
                        className="form-select"
                        value={paymentForm.plan}
                        onChange={(event) =>
                          setPaymentForm((current) => ({ ...current, plan: event.target.value }))
                        }
                      >
                        <option value="MONTHLY">Monthly</option>
                        <option value="YEARLY">Yearly</option>
                      </select>
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-medium">Payment mode</label>
                      <select
                        className="form-select"
                        value={paymentForm.payment_mode}
                        onChange={(event) =>
                          setPaymentForm((current) => ({ ...current, payment_mode: event.target.value }))
                        }
                      >
                        <option value="UPI">UPI</option>
                        <option value="CASH">Cash</option>
                      </select>
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-medium">Your UPI ID / mobile</label>
                      <input
                        className="form-control"
                        placeholder="Optional reference for admin"
                        value={paymentForm.payer_contact}
                        onChange={(event) =>
                          setPaymentForm((current) => ({ ...current, payer_contact: event.target.value }))
                        }
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-medium">
                        {paymentForm.payment_mode === "UPI" ? "UPI transaction ID" : "Cash receipt number"}
                      </label>
                      <input
                        className="form-control"
                        placeholder={paymentForm.payment_mode === "UPI" ? "Enter transaction ID" : "Enter receipt number"}
                        value={paymentForm.upi_ref}
                        onChange={(event) =>
                          setPaymentForm((current) => ({ ...current, upi_ref: event.target.value }))
                        }
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-medium">Screenshot / receipt</label>
                      <input
                        type="file"
                        className="form-control"
                        accept="image/*,.pdf"
                        onChange={(event) =>
                          setPaymentForm((current) => ({
                            ...current,
                            screenshot: event.target.files?.[0] || null,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="d-flex flex-wrap gap-2 mt-3">
                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                      {submitting ? "Submitting…" : "Submit payment proof"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setShowPaymentForm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {latestPaymentRequest?.status === "PENDING" && (
              <div className="subscribe-alert-card mt-4">
                <div className="subscribe-alert-icon">
                  <i className="fa-solid fa-shield-check"></i>
                </div>
                <div>
                  <h3>Payment submitted</h3>
                  <p className="mb-1">
                    Our team will verify and activate your account within 24 hours. Your data is safe.
                  </p>
                  {latestSubmittedAt && (
                    <small className="text-muted">Submitted on {latestSubmittedAt}</small>
                  )}
                </div>
              </div>
            )}

            {latestPaymentRequest?.status === "REJECTED" && (
              <div className="subscribe-alert-card rejected mt-4">
                <div className="subscribe-alert-icon">
                  <i className="fa-solid fa-circle-exclamation"></i>
                </div>
                <div>
                  <h3>Last payment request was rejected</h3>
                  <p className="mb-1">{latestPaymentRequest.admin_notes || "Please resubmit with correct payment details."}</p>
                  <small className="text-muted">You can submit a fresh payment proof below.</small>
                </div>
              </div>
            )}

            <div className="subscribe-info-card">
              <div>
                <h3>Need a different route?</h3>
                <p>
                  Use the admin-reviewed payment flow above. If you need help, contact support and share your company name.
                </p>
              </div>

              <div className="subscribe-info-actions">
                {user ? (
                  <button type="button" className="btn btn-outline-secondary" onClick={() => navigate("/dashboard")}>
                    <i className="fa-solid fa-arrow-left me-2"></i>Back to app
                  </button>
                ) : (
                  <button type="button" className="btn btn-outline-secondary" onClick={() => navigate("/")}>
                    <i className="fa-solid fa-arrow-left me-2"></i>Back to login
                  </button>
                )}

                <a className="btn btn-outline-primary" href={`mailto:${supportEmail}?subject=TriHub%20Subscription%20Support`}>
                  <i className="fa-regular fa-envelope me-2"></i>Contact support
                </a>

                {user && (
                  <button
                    type="button"
                    className="btn btn-link text-decoration-none"
                    onClick={() => {
                      logout();
                      navigate("/");
                    }}
                  >
                    Sign out
                  </button>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      <div className="auth-bg-decoration">
        <div className="auth-bg-circle auth-bg-circle-1"></div>
        <div className="auth-bg-circle auth-bg-circle-2"></div>
        <div className="auth-bg-circle auth-bg-circle-3"></div>
      </div>
    </div>
  );
}
