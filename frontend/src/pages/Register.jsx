import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import BrandLogo from "../../components/shared/BrandLogo";
import GoogleAuthButton from "../../components/auth/GoogleAuthButton";
import api from "../../utils/api";
import { toast } from "react-toastify";

const PROMO_ITEMS = [
  {
    icon: "fa-solid fa-gift",
    label: "7-day Trial",
  },
  {
    icon: "fa-solid fa-mobile-screen-button",
    label: "Mobile Ready",
  },
  {
    icon: "fa-solid fa-bolt",
    label: "Fast Setup",
  },
];

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({
    name: "",
    company_name: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  
  const [googleCredential, setGoogleCredential] = useState(null);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);

  const handleAuthSuccess = (response) => {
    if (response.data.warning === "SUBSCRIPTION_EXPIRED") {
      login(response.data.token, response.data.user, response.data.company || null);
      navigate("/subscribe");
      return;
    }

    login(response.data.token, response.data.user, response.data.company || null);
    toast.success(response.data.message || "Registration successful!");
    navigate("/dashboard");
  };

  
  const handleGoogleCredential = (credential) => {
    try {
      
      const parts = credential.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        setVerifiedEmail(payload.email || "");
        
        if (!form.name.trim() && payload.name) {
          setForm((current) => ({ ...current, name: payload.name }));
        }
      }
    } catch {
      
    }

    setGoogleCredential(credential);
    toast.success("Email verified via Google! Complete the form and submit.");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!googleCredential) {
      toast.error("Please verify your email with Google first");
      return;
    }

    if (!form.name.trim()) {
      toast.error("Please enter your full name");
      return;
    }

    if (!form.company_name.trim()) {
      toast.error("Please enter your company name");
      return;
    }

    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/\d/.test(form.password) || !/[^\w\s]/.test(form.password)) {
      toast.error("Use uppercase, lowercase, number, and special character in the password");
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/register-with-google", {
        credential: googleCredential,
        name: form.name,
        company_name: form.company_name,
        password: form.password,
      });
      handleAuthSuccess(res);
    } catch (err) {
      
      if (err.response?.status === 400 && err.response?.data?.error?.includes("expired")) {
        setGoogleCredential(null);
        setVerifiedEmail("");
        toast.error("Google verification expired. Please verify again.");
      } else {
        toast.error(err.response?.data?.error || "Registration failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper auth-shell">
      <div className="auth-card auth-card-wide">
        <section className="auth-promo auth-promo-register">
          <span className="auth-kicker">TriHub onboarding</span>
          <BrandLogo tone="light" size="lg" stacked className="auth-brand" />
          <h1 className="auth-hero-title">Create your workspace.</h1>
          <p className="auth-hero-copy">Get started fast with a cleaner billing and CRM setup.</p>

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
            <span className="auth-form-eyebrow">Create workspace</span>
            <h2 className="auth-form-title">Launch your company CRM</h2>
            <p className="auth-form-subtitle">Verify your email with Google, set a password, and become the master user.</p>
            <span className="badge auth-trial-badge">
              <i className="fa-solid fa-gift me-1"></i>7-day free trial
            </span>
          </div>

          {}
          {!googleCredential ? (
            <div className="mb-4">
              <div
                className="d-flex align-items-center gap-2 mb-3 p-3"
                style={{
                  background: "var(--bs-light, #f8f9fa)",
                  borderRadius: 12,
                  border: "1px solid var(--bs-border-color)",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #4285F4, #34A853)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <i className="fa-solid fa-shield-check" style={{ color: "#fff", fontSize: 16 }}></i>
                </div>
                <div>
                  <div className="fw-semibold small">Step 1 — Verify your email</div>
                  <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                    Sign in with Google to verify your email address. This ensures account security.
                  </div>
                </div>
              </div>

              <GoogleAuthButton
                mode="register"
                busy={googleBusy}
                onCredential={handleGoogleCredential}
              />
            </div>
          ) : (
            <>
              {}
              <div
                className="d-flex align-items-center gap-2 mb-3 p-3"
                style={{
                  background: "linear-gradient(135deg, rgba(25, 135, 84, 0.08), rgba(25, 135, 84, 0.03))",
                  borderRadius: 12,
                  border: "1px solid rgba(25, 135, 84, 0.25)",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #198754, #20c997)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <i className="fa-solid fa-circle-check" style={{ color: "#fff", fontSize: 16 }}></i>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="fw-semibold small text-success">Email verified via Google</div>
                  <div className="text-muted text-truncate" style={{ fontSize: "0.8rem" }}>
                    {verifiedEmail}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary ms-auto"
                  onClick={() => {
                    setGoogleCredential(null);
                    setVerifiedEmail("");
                  }}
                  title="Use a different Google account"
                  style={{ flexShrink: 0 }}
                >
                  <i className="fa-solid fa-rotate"></i>
                </button>
              </div>

              {}
              <form onSubmit={handleSubmit} noValidate>
                <div className="mb-3">
                  <label className="form-label fw-medium small">
                    <i className="fa-solid fa-user me-1"></i>Full Name
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Your full name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    id="register-name"
                  />
                  <div className="form-text">Auto-filled from Google. You can edit this.</div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-medium small">
                    <i className="fa-solid fa-building me-1"></i>Company Name
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Your company name"
                    value={form.company_name}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    autoFocus
                    id="register-company"
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
                      placeholder="Min 8 chars with Aa1!"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      id="register-password"
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

                <div className="mb-3">
                  <label className="form-label fw-medium small">
                    <i className="fa-solid fa-lock me-1"></i>Confirm Password
                  </label>
                  <div className="input-group">
                    <input
                      type={showConfirmPass ? "text" : "password"}
                      className="form-control"
                      placeholder="Repeat password"
                      value={form.confirmPassword}
                      onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                      id="register-confirm"
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                    >
                      <i className={`fa-regular fa-eye${showConfirmPass ? "-slash" : ""}`}></i>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100 mt-2"
                  disabled={loading}
                  id="register-submit"
                >
                  {loading ? (
                    <><span className="spinner-border spinner-border-sm me-2" />Creating workspace...</>
                  ) : (
                    <><i className="fa-solid fa-user-plus me-2"></i>Create Workspace</>
                  )}
                </button>
              </form>
            </>
          )}

          <div className="auth-footer auth-footer-left">
            Already have an account?{" "}
            <Link to="/" className="fw-semibold">Sign in</Link>
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
