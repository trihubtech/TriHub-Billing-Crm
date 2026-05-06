import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import AuthImage from "../components/shared/AuthImage";
import PageHeader from "../components/shared/PageHeader";
import PhoneInput from "../components/shared/PhoneInput";
import { hasPermission } from "../utils/permissions";

function mapUserToForm(user) {
  return {
    salutation: user?.salutation || "Mr.",
    name: user?.name || "",
    dob: user?.dob ? user.dob.split("T")[0] : "",
    designation: user?.designation || "",
    mobile: user?.mobile || "",
  };
}

function mapCompanyToForm(company) {
  return {
    name: company?.name || "",
    address: company?.address || "",
    phone: company?.phone || "",
    email: company?.email || "",
    gstin: company?.gstin || "",
    pan: company?.pan || "",
    website: company?.website || "",
    upi_id: company?.upi_id || "",
    upi_name: company?.upi_name || "",
  };
}

function formatStorageUsed(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  return `${(value / 1024).toFixed(1)} KB`;
}

export default function Profile() {
  const { user, company, updateProfile, updateCompany } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const canViewCompany = hasPermission(user, "can_view_company");
  const canEditCompany = hasPermission(user, "can_edit_company");

  const [profileForm, setProfileForm] = useState({
    salutation: "Mr.",
    name: "",
    dob: "",
    designation: "",
    mobile: "",
  });
  const [profilePic, setProfilePic] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [companyForm, setCompanyForm] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    gstin: "",
    pan: "",
    website: "",
    upi_id: "",
    upi_name: "",
  });
  const [logo, setLogo] = useState(null);
  const [upiQrFile, setUpiQrFile] = useState(null);
  const [savingCompany, setSavingCompany] = useState(false);
  const [uploadingUpiQr, setUploadingUpiQr] = useState(false);
  const [removingUpiQr, setRemovingUpiQr] = useState(false);

  const [passForm, setPassForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [savingPass, setSavingPass] = useState(false);

  const [activities, setActivities] = useState([]);
  const [actPage, setActPage] = useState(1);
  const [actTotal, setActTotal] = useState(0);
  const [loadingAct, setLoadingAct] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileForm(mapUserToForm(user));
    }
    if (company) {
      setCompanyForm(mapCompanyToForm(company));
    }
  }, [user, company]);

  useEffect(() => {
    if (activeTab === "company" && !canViewCompany) {
      setActiveTab("profile");
    }
  }, [activeTab, canViewCompany]);

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const formData = new FormData();
      Object.entries(profileForm).forEach(([key, value]) => formData.append(key, value || ""));
      if (profilePic) formData.append("profile_picture", profilePic);

      const res = await api.put("/profile", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const savedProfile = res.data.data || profileForm;
      updateProfile(savedProfile);
      setProfileForm(mapUserToForm(savedProfile));
      setProfilePic(null);
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveCompany = async (event) => {
    event.preventDefault();
    setSavingCompany(true);
    try {
      const formData = new FormData();
      Object.entries(companyForm).forEach(([key, value]) => formData.append(key, value || ""));
      if (logo) formData.append("logo", logo);

      const res = await api.put("/profile/company", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const savedCompany = res.data.data || companyForm;
      updateCompany(savedCompany);
      setCompanyForm(mapCompanyToForm(savedCompany));
      setLogo(null);
      toast.success("Company profile updated");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to update company profile");
    } finally {
      setSavingCompany(false);
    }
  };

  const handleUploadUpiQr = async () => {
    if (!upiQrFile) {
      toast.error("Choose a UPI QR image first");
      return;
    }

    setUploadingUpiQr(true);
    try {
      const formData = new FormData();
      formData.append("upi_qr_image", upiQrFile);
      const res = await api.post("/profile/company/upi-qr", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      updateCompany(res.data.data || {});
      setUpiQrFile(null);
      toast.success("UPI QR image uploaded");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to upload UPI QR image");
    } finally {
      setUploadingUpiQr(false);
    }
  };

  const handleRemoveUpiQr = async () => {
    setRemovingUpiQr(true);
    try {
      const res = await api.delete("/profile/company/upi-qr");
      updateCompany(res.data.data || {});
      toast.success("UPI QR image removed");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to remove UPI QR image");
    } finally {
      setRemovingUpiQr(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    if (passForm.new_password !== passForm.confirm_password) {
      toast.error("Passwords don't match");
      return;
    }

    setSavingPass(true);
    try {
      await api.put("/profile/password", passForm);
      toast.success("Password changed");
      setPassForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to change password");
    } finally {
      setSavingPass(false);
    }
  };

  const loadActivities = useCallback(async () => {
    setLoadingAct(true);
    try {
      const res = await api.get(`/profile/activities?page=${actPage}&pageSize=15`);
      setActivities(res.data.data || []);
      setActTotal(res.data.total || 0);
    } catch {
      
    } finally {
      setLoadingAct(false);
    }
  }, [actPage]);

  useEffect(() => {
    if (activeTab === "activity") {
      loadActivities();
    }
  }, [activeTab, loadActivities]);

  const tabs = [
    { key: "profile", label: "Profile", icon: "fa-solid fa-user" },
    canViewCompany
      ? { key: "company", label: "Company", icon: "fa-solid fa-building" }
      : null,
    { key: "password", label: "Password", icon: "fa-solid fa-lock" },
    { key: "activity", label: "Activity", icon: "fa-solid fa-clock-rotate-left" },
  ].filter(Boolean);

  return (
    <div>
      <PageHeader title="My Profile" icon="fa-solid fa-user-gear" />

      <ul className="nav nav-pills mb-3 gap-1">
        {tabs.map((tab) => (
          <li key={tab.key} className="nav-item">
            <button
              className={`nav-link btn-sm ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <i className={`${tab.icon} me-1`}></i>{tab.label}
            </button>
          </li>
        ))}
      </ul>

      {activeTab === "profile" && (
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <form onSubmit={handleSaveProfile}>
              <div className="row g-3">
                <div className="col-4 col-md-2">
                  <label className="form-label small fw-medium">Salutation</label>
                  <select
                    className="form-select form-select-sm"
                    value={profileForm.salutation}
                    onChange={(event) => setProfileForm({ ...profileForm, salutation: event.target.value })}
                  >
                    {["Mr.", "Mrs.", "Ms.", "Dr."].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </div>
                <div className="col-8 col-md-4">
                  <label className="form-label small fw-medium">Name</label>
                  <input
                    className="form-control form-control-sm"
                    value={profileForm.name}
                    onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })}
                    required
                  />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label small fw-medium">Date of Birth</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={profileForm.dob}
                    onChange={(event) => setProfileForm({ ...profileForm, dob: event.target.value })}
                  />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label small fw-medium">Designation</label>
                  <input
                    className="form-control form-control-sm"
                    value={profileForm.designation}
                    onChange={(event) => setProfileForm({ ...profileForm, designation: event.target.value })}
                  />
                </div>
                <div className="col-12">
                  <div className={`p-3 rounded border ${user?.must_change_password ? "bg-warning-subtle border-warning-subtle" : "bg-success-subtle border-success-subtle"}`}>
                    <div className="d-flex align-items-center gap-3">
                      <div className={`rounded-circle d-flex align-items-center justify-content-center ${user?.must_change_password ? "bg-warning text-dark" : "bg-success text-white"}`} style={{ width: "40px", height: "40px" }}>
                        <i className={`fa-solid ${user?.must_change_password ? "fa-exclamation" : "fa-check"}`}></i>
                      </div>
                      <div>
                        <div className="fw-bold small">{user?.must_change_password ? "Temporary password in use" : "Account active"}</div>
                        <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                          {user?.must_change_password
                            ? "You must replace your temporary password before using the workspace normally."
                            : `Password set on ${new Date(user.email_verified_at || user.created_at).toLocaleDateString()}`}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">Mobile</label>
                  <PhoneInput
                    className="input-group-sm"
                    value={profileForm.mobile}
                    onChange={(event) => setProfileForm({ ...profileForm, mobile: event.target.value })}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">Profile Picture</label>
                  <input
                    type="file"
                    className="form-control form-control-sm"
                    accept="image/*"
                    onChange={(event) => setProfilePic(event.target.files?.[0] || null)}
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-sm mt-3" disabled={savingProfile}>
                {savingProfile ? "Saving..." : "Save Profile"}
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === "company" && canViewCompany && (
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <form onSubmit={handleSaveCompany}>
              <fieldset disabled={!canEditCompany} className="border-0 p-0 m-0">
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-medium">Company Name *</label>
                  <input
                    className="form-control form-control-sm"
                    value={companyForm.name}
                    onChange={(event) => setCompanyForm({ ...companyForm, name: event.target.value })}
                    required
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-medium">Logo</label>
                  <input
                    type="file"
                    className="form-control form-control-sm"
                    accept="image/*"
                    onChange={(event) => setLogo(event.target.files?.[0] || null)}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label small fw-medium">Address</label>
                  <textarea
                    className="form-control form-control-sm"
                    rows={2}
                    value={companyForm.address}
                    onChange={(event) => setCompanyForm({ ...companyForm, address: event.target.value })}
                  />
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label small fw-medium">Phone</label>
                  <PhoneInput
                    className="input-group-sm"
                    value={companyForm.phone}
                    onChange={(event) => setCompanyForm({ ...companyForm, phone: event.target.value })}
                  />
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label small fw-medium">Email</label>
                  <input
                    type="email"
                    className="form-control form-control-sm"
                    value={companyForm.email}
                    onChange={(event) => setCompanyForm({ ...companyForm, email: event.target.value })}
                  />
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label small fw-medium">Website</label>
                  <input
                    className="form-control form-control-sm"
                    value={companyForm.website}
                    onChange={(event) => setCompanyForm({ ...companyForm, website: event.target.value })}
                  />
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label small fw-medium">GSTIN</label>
                  <input
                    className="form-control form-control-sm"
                    value={companyForm.gstin}
                    onChange={(event) => setCompanyForm({ ...companyForm, gstin: event.target.value })}
                  />
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label small fw-medium">PAN</label>
                  <input
                    className="form-control form-control-sm"
                    value={companyForm.pan}
                    onChange={(event) => setCompanyForm({ ...companyForm, pan: event.target.value })}
                  />
                </div>
                <div className="col-12">
                  <hr className="my-1" />
                  <small className="text-muted fw-bold">UPI Payment Settings (for Invoice QR)</small>
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">UPI ID</label>
                  <input
                    className="form-control form-control-sm"
                    value={companyForm.upi_id}
                    onChange={(event) => setCompanyForm({ ...companyForm, upi_id: event.target.value })}
                    placeholder="yourname@upi"
                  />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">UPI Display Name</label>
                  <input
                    className="form-control form-control-sm"
                    value={companyForm.upi_name}
                    onChange={(event) => setCompanyForm({ ...companyForm, upi_name: event.target.value })}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-medium">Upload UPI QR Image</label>
                  <input
                    type="file"
                    className="form-control form-control-sm"
                    accept="image/*"
                    onChange={(event) => setUpiQrFile(event.target.files?.[0] || null)}
                  />
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={handleUploadUpiQr}
                      disabled={!upiQrFile || uploadingUpiQr}
                    >
                      {uploadingUpiQr ? "Uploading..." : "Upload UPI QR"}
                    </button>
                    {company?.upi_qr_image && (
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={handleRemoveUpiQr}
                        disabled={removingUpiQr}
                      >
                        {removingUpiQr ? "Removing..." : "Remove"}
                      </button>
                    )}
                  </div>
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-medium">Current QR Preview</label>
                  <div className="profile-qr-preview">
                    {company?.upi_qr_image ? (
                      <AuthImage
                        src={company.upi_qr_image}
                        alt="UPI QR"
                        className="img-fluid rounded"
                        style={{ maxHeight: 200 }}
                      />
                    ) : (
                      <span className="text-muted small">No UPI QR uploaded yet</span>
                    )}
                  </div>
                  <div className="small text-muted mt-2">
                    Storage used: {formatStorageUsed(company?.storage_used_bytes)}
                  </div>
                </div>
              </div>
              </fieldset>
              <button type="submit" className="btn btn-primary btn-sm mt-3" disabled={!canEditCompany || savingCompany}>
                {savingCompany ? "Saving..." : "Save Company"}
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === "password" && (
        <div className="card border-0 shadow-sm" style={{ maxWidth: "450px" }}>
          <div className="card-body">
            <form onSubmit={handleChangePassword}>
              <div className="mb-3">
                <label className="form-label small fw-medium">Current Password</label>
                <input
                  type="password"
                  className="form-control form-control-sm"
                  value={passForm.current_password}
                  onChange={(event) => setPassForm({ ...passForm, current_password: event.target.value })}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-medium">New Password</label>
                <input
                  type="password"
                  className="form-control form-control-sm"
                  value={passForm.new_password}
                  onChange={(event) => setPassForm({ ...passForm, new_password: event.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-medium">Confirm New Password</label>
                <input
                  type="password"
                  className="form-control form-control-sm"
                  value={passForm.confirm_password}
                  onChange={(event) => setPassForm({ ...passForm, confirm_password: event.target.value })}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={savingPass}>
                {savingPass ? "Changing..." : "Change Password"}
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === "activity" && (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            {loadingAct ? (
              <div className="text-center py-4">
                <div className="spinner-border spinner-border-sm text-primary" />
              </div>
            ) : (
              <div className="list-group list-group-flush">
                {activities.map((activity) => (
                  <div key={activity.id} className="list-group-item bg-transparent py-2">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <span className="badge bg-primary bg-opacity-10 text-primary me-2" style={{ fontSize: "0.65rem" }}>
                          {activity.type.replace(/_/g, " ")}
                        </span>
                        <span className="small">{activity.description}</span>
                      </div>
                      <small className="text-muted text-nowrap">
                        {new Date((activity.created_at || "").replace(" ", "T")).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </div>
                  </div>
                ))}
                {activities.length === 0 && (
                  <div className="text-center text-muted py-4 small">No activity yet</div>
                )}
              </div>
            )}
            {actTotal > 15 && (
              <div className="d-flex justify-content-center gap-2 p-3 border-top">
                <button
                  className="btn btn-outline-primary btn-sm"
                  disabled={actPage <= 1}
                  onClick={() => setActPage((current) => current - 1)}
                >
                  Previous
                </button>
                <button
                  className="btn btn-outline-primary btn-sm"
                  disabled={actPage * 15 >= actTotal}
                  onClick={() => setActPage((current) => current + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
