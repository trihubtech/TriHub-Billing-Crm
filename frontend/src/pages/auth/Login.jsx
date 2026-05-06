import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import BrandLogo from "../../components/shared/BrandLogo";
import api from "../../utils/api";
import { toast } from "react-toastify";

const PROMO_ITEMS = [
  {
    icon: "fa-solid fa-receipt",
    label: "Smart Billing",
  },
  {
    icon: "fa-solid fa-boxes-stacked",
    label: "Stock Sync",
  },
  {
    icon: "fa-solid fa-chart-line",
    label: "Quick Reports",
  },
];

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleAuthSuccess = (response) => {
    if (response.data.warning === "MUST_CHANGE_PASSWORD") {
      login(response.data.token, response.data.user, response.data.company || null);
      toast.info(response.data.message || "Change your temporary password to continue.");
      navigate("/set-password");
      return;
    }

    if (response.data.warning === "SUBSCRIPTION_EXPIRED") {
      login(response.data.token, response.data.user, response.data.company || null);
      navigate("/subscribe");
      return;
    }

    login(response.data.token, response.data.user, response.data.company || null);
    toast.success(response.data.message || `Welcome back, ${response.data.user.name}!`);
    navigate(response.data.user?.is_platform_admin ? "/admin" : "/dashboard");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/login", form);
      handleAuthSuccess(res);
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.error === "SUBSCRIPTION_ACCOUNT_DISABLED") {
        toast.error(
          errData.message ||
            "Your workspace subscription has expired. Please contact your workspace administrator to renew.",
          { autoClose: 8000 }
        );
      } else if (errData?.error === "ACCOUNT_DISABLED") {
        toast.error(
          errData.message || "This account has been disabled by your workspace administrator.",
          { autoClose: 8000 }
        );
      } else {
        toast.error(errData?.error || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper auth-shell">
      <div className="auth-card auth-card-wide">
        <section className="auth-promo auth-promo-login">
          <span className="auth-kicker">TriHub Billing CRM</span>
          <BrandLogo tone="light" size="lg" stacked className="auth-brand" />
          <h1 className="auth-hero-title">Run billing beautifully.</h1>
          <p className="auth-hero-copy">CRM, invoices, stock, and reports in one polished workspace.</p>

          <div className="auth-promo-stage" aria-hidden="true">
            <div className="auth-orbit auth-orbit-one"></div>
            <div className="auth-orbit auth-orbit-two"></div>
            <div className="auth-glow auth-glow-one"></div>
            <div className="auth-glow auth-glow-two"></div>
            <div className="auth-float-grid">
              {PROMO_ITEMS.map((item, index) => (
                <div key={item.label} className={`auth-float-chip auth-float-chip-${index + 1}`}>
                  <i className={item.icon}></i>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="auth-form-panel">
          <div className="auth-header auth-header-left">
            <BrandLogo tone="dark" size="md" className="d-lg-none mb-3" />
            <span className="auth-form-eyebrow">Welcome back</span>
            <h2 className="auth-form-title">Sign in to continue</h2>
            <p className="auth-form-subtitle">Use your workspace email and password to continue.</p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label className="form-label fw-medium small">
                <i className="fa-regular fa-envelope me-1"></i>Email
              </label>
              <input
                type="email"
                className="form-control"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoFocus
                id="login-email"
              />
            </div>

            <div className="mb-3">
              <label className="form-label fw-medium small">
                <i className="fa-solid fa-lock me-1"></i>Password
              </label>
              <div className="input-group">
                <input
                  type={showPass ? "text" : "password"}
                  className="form-control"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  id="login-password"
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowPass(!showPass)}
                >
                  <i className={`fa-regular fa-eye${showPass ? "-slash" : ""}`}></i>
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100 mt-2"
              disabled={loading}
              id="login-submit"
            >
              {loading ? (
                <><span className="spinner-border spinner-border-sm me-2" />Signing in...</>
              ) : (
                <><i className="fa-solid fa-right-to-bracket me-2"></i>Sign In</>
              )}
            </button>
          </form>

          <div className="auth-footer auth-footer-left">
            Need an account?{" "}
            <Link to="/register" className="fw-semibold">Create one</Link>
          </div>
        </section>
      </div>

      <div className="auth-bg-decoration">
        <div className="auth-bg-circle auth-bg-circle-1"></div>
        <div className="auth-bg-circle auth-bg-circle-2"></div>
        <div className="auth-bg-circle auth-bg-circle-3"></div>
      </div>
    </div>
  );
}
