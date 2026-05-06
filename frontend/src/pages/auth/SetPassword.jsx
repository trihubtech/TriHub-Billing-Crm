import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import BrandLogo from "../../components/shared/BrandLogo";
import { useAuth } from "../../context/AuthContext";
import api from "../../utils/api";

export default function SetPassword() {
  const navigate = useNavigate();
  const { token, user, company, login } = useAuth();
  const [form, setForm] = useState({
    new_password: "",
    confirm_password: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.new_password || form.new_password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (form.new_password !== form.confirm_password) {
      toast.error("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post("/auth/change-temporary-password", form);
      const updatedUser = res.data.user || user;
      login(token, updatedUser, res.data.company || company || null);
      toast.success(res.data.message || "Password updated");
      navigate(updatedUser?.is_platform_admin ? "/admin" : "/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to update password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-wrapper auth-shell">
      <div className="auth-card auth-card-wide">
        <section className="auth-promo auth-promo-register">
          <span className="auth-kicker">First login security</span>
          <BrandLogo tone="light" size="lg" stacked className="auth-brand" />
          <h1 className="auth-hero-title">Set your own password.</h1>
          <p className="auth-hero-copy">You signed in with a temporary password. Replace it now before entering the workspace.</p>
        </section>

        <section className="auth-form-panel">
          <div className="auth-header auth-header-left">
            <BrandLogo tone="dark" size="md" className="d-lg-none mb-3" />
            <span className="auth-form-eyebrow">Security step</span>
            <h2 className="auth-form-title">Create a new password</h2>
            <p className="auth-form-subtitle">{user?.email || "Your workspace account"}</p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label className="form-label fw-medium small">New Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="Use at least 8 chars with Aa1!"
                value={form.new_password}
                onChange={(event) => setForm({ ...form, new_password: event.target.value })}
              />
            </div>

            <div className="mb-3">
              <label className="form-label fw-medium small">Confirm Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="Repeat your new password"
                value={form.confirm_password}
                onChange={(event) => setForm({ ...form, confirm_password: event.target.value })}
              />
            </div>

            <button type="submit" className="btn btn-primary w-100" disabled={submitting}>
              {submitting ? "Updating password..." : "Save New Password"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
