import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import BrandLogo from "../../components/shared/BrandLogo";
import { useAuth } from "../../context/AuthContext";
import api from "../../utils/api";

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invite, setInvite] = useState(null);
  const [form, setForm] = useState({
    name: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    async function loadInvite() {
      try {
        const res = await api.get(`/auth/invite/${token}`);
        setInvite(res.data.data);
        setForm((current) => ({
          ...current,
          name: current.name || "",
        }));
      } catch (error) {
        toast.error(error.response?.data?.error || "Invite link is invalid");
      } finally {
        setLoadingInvite(false);
      }
    }

    loadInvite();
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.password || form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post("/auth/accept-invite", {
        token,
        name: form.name,
        password: form.password,
      });

      login(res.data.token, res.data.user, res.data.company || null);
      toast.success(res.data.message || "Invite accepted");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to accept invite");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-wrapper auth-shell">
      <div className="auth-card auth-card-wide">
        <section className="auth-promo auth-promo-register">
          <span className="auth-kicker">Workspace invite</span>
          <BrandLogo tone="light" size="lg" stacked className="auth-brand" />
          <h1 className="auth-hero-title">Join your company CRM.</h1>
          <p className="auth-hero-copy">Set your password once and enter the shared workspace with your assigned permissions.</p>
        </section>

        <section className="auth-form-panel">
          <div className="auth-header auth-header-left">
            <BrandLogo tone="dark" size="md" className="d-lg-none mb-3" />
            <span className="auth-form-eyebrow">Accept invite</span>
            <h2 className="auth-form-title">Set your password</h2>
            <p className="auth-form-subtitle">
              {loadingInvite
                ? "Loading invite details..."
                : invite
                  ? `${invite.email} joining ${invite.company_name}`
                  : "This invite could not be loaded."}
            </p>
          </div>

          {invite && !loadingInvite ? (
            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-3">
                <label className="form-label fw-medium small">Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Your full name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-medium small">Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Create a strong password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-medium small">Confirm Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Repeat password"
                  value={form.confirmPassword}
                  onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
                />
              </div>

              <button type="submit" className="btn btn-primary w-100" disabled={submitting}>
                {submitting ? "Joining workspace..." : "Join Workspace"}
              </button>
            </form>
          ) : (
            <div className="alert alert-warning mb-0">This invite is invalid, expired, or already used.</div>
          )}
        </section>
      </div>
    </div>
  );
}
