import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import PageHeader from "../components/shared/PageHeader";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";
import { formatIndiaDate } from "../utils/time";

function roleBadge(role) {
  switch (role) {
    case "MASTER": return "bg-primary-subtle text-primary-emphasis";
    case "ADMIN": return "bg-info-subtle text-info-emphasis";
    default: return "bg-secondary-subtle text-secondary-emphasis";
  }
}

function statusBadge(status) {
  return status === "ACTIVE"
    ? "bg-success-subtle text-success-emphasis"
    : "bg-danger-subtle text-danger-emphasis";
}

function avatarLetter(name) {
  return (name || "?")[0].toUpperCase();
}

function groupPermissionOptions(permissionOptions) {
  return permissionOptions.reduce((groups, permission) => {
    if (!groups[permission.module]) {
      groups[permission.module] = [];
    }

    groups[permission.module].push(permission);
    return groups;
  }, {});
}

function PermissionChecklist({ permissionOptions, selectedPermissions, onToggle, inputPrefix, disabled = false }) {
  const groupedPermissions = useMemo(
    () => groupPermissionOptions(permissionOptions),
    [permissionOptions]
  );

  return Object.entries(groupedPermissions).map(([moduleName, permissions]) => (
    <div key={moduleName} className="mb-3">
      <div className="small fw-semibold text-uppercase text-muted mb-2">{moduleName}</div>
      {permissions.map((permission) => (
        <div key={permission.key} className="form-check mb-2">
          <input
            className="form-check-input"
            type="checkbox"
            id={`${inputPrefix}-${permission.key}`}
            checked={selectedPermissions.includes(permission.key)}
            disabled={disabled}
            onChange={() => onToggle(permission.key)}
          />
          <label className="form-check-label" htmlFor={`${inputPrefix}-${permission.key}`}>
            <span className="fw-medium">{permission.label}</span>
            <span className="d-block text-muted small text-capitalize">{permission.action}</span>
          </label>
        </div>
      ))}
    </div>
  ));
}

function PermissionEditor({ member, permissionOptions, onSaved, disabled = false }) {
  const [permissions, setPermissions] = useState([...(member.permissions || [])]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPermissions([...(member.permissions || [])]);
  }, [member.id, member.permissions]);

  const togglePermission = (permissionKey) => {
    setPermissions((current) =>
      current.includes(permissionKey)
        ? current.filter((value) => value !== permissionKey)
        : [...current, permissionKey]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/company-users/${member.id}`, {
        role: member.role,
        status: member.status,
        permissions,
      });
      toast.success(`Permissions updated for ${member.name}`);
      onSaved();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to update permissions");
    } finally {
      setSaving(false);
    }
  };

  const isDirty =
    JSON.stringify([...permissions].sort()) !==
    JSON.stringify([...(member.permissions || [])].sort());

  return (
    <div className="team-permission-editor">
      <div className="team-permission-grid">
        <PermissionChecklist
          permissionOptions={permissionOptions}
          selectedPermissions={permissions}
          onToggle={togglePermission}
          inputPrefix={`member-${member.id}`}
          disabled={disabled}
        />
      </div>

      <div className="d-flex justify-content-end gap-2 mt-3">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          disabled={disabled || !isDirty || saving}
          onClick={() => setPermissions([...(member.permissions || [])])}
        >
          Reset
        </button>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={disabled || !isDirty || saving}
          onClick={handleSave}
        >
          {saving ? (
            <><i className="fa-solid fa-spinner fa-spin me-1"></i>Saving...</>
          ) : (
            <><i className="fa-solid fa-floppy-disk me-1"></i>Save</>
          )}
        </button>
      </div>
    </div>
  );
}

function UserDetailRow({
  member,
  permissionOptions,
  colSpan,
  onRefresh,
  currentUserId,
  canViewUsers,
  canEditUsers,
}) {
  const [confirmDisable, setConfirmDisable] = useState(false);

  const handleStatusChange = async (nextStatus) => {
    try {
      await api.patch(`/company-users/${member.id}`, { status: nextStatus });
      toast.success(`${member.name} ${nextStatus === "ACTIVE" ? "enabled" : "disabled"}`);
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to update status");
    } finally {
      setConfirmDisable(false);
    }
  };

  return (
    <tr className="team-detail-row">
      <td colSpan={colSpan} className="p-0">
        <div className="team-detail-panel">
          <div className="team-detail-profile">
            <div className="team-detail-avatar">{avatarLetter(member.name)}</div>
            <div>
              <div className="fw-semibold fs-6">{member.name}</div>
              <div className="small text-muted">{member.email}</div>
              <div className="mt-1 d-flex gap-2 flex-wrap">
                <span className={`badge ${roleBadge(member.role)}`}>{member.role}</span>
                <span className={`badge ${statusBadge(member.status)}`}>{member.status}</span>
                {member.must_change_password && (
                  <span className="badge bg-warning-subtle text-warning-emphasis">
                    <i className="fa-solid fa-key me-1"></i>Must change password
                  </span>
                )}
              </div>
              <div className="small text-muted mt-1">
                Joined {formatIndiaDate(member.created_at)}
              </div>
            </div>
          </div>

          {canViewUsers && member.role === "NORMAL" && (
            <div className="team-detail-perms">
              <div className="fw-semibold mb-2">
                <i className="fa-solid fa-sliders me-2 text-primary"></i>Permissions
              </div>
              <PermissionEditor
                member={member}
                permissionOptions={permissionOptions}
                onSaved={onRefresh}
                disabled={!canEditUsers}
              />
            </div>
          )}

          {canViewUsers && member.role !== "NORMAL" && (
            <div className="team-detail-perms">
              <div className="fw-semibold mb-1">
                <i className="fa-solid fa-sliders me-2 text-primary"></i>Permissions
              </div>
              <p className="text-muted small mb-0">
                This user has <strong>full access</strong> to all modules as a {member.role}.
              </p>
            </div>
          )}

          {canEditUsers && member.id !== currentUserId && (
            <div className="team-detail-actions">
              {confirmDisable ? (
                <div className="d-flex flex-column gap-2 align-items-start">
                  <span className="small text-danger fw-medium">
                    Are you sure you want to {member.status === "ACTIVE" ? "disable" : "enable"} this user?
                  </span>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className={`btn btn-sm ${member.status === "ACTIVE" ? "btn-danger" : "btn-success"}`}
                      onClick={() => handleStatusChange(member.status === "ACTIVE" ? "DISABLED" : "ACTIVE")}
                    >
                      Confirm
                    </button>
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setConfirmDisable(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className={`btn btn-sm ${member.status === "ACTIVE" ? "btn-outline-danger" : "btn-outline-success"}`}
                  onClick={() => setConfirmDisable(true)}
                >
                  <i className={`fa-solid ${member.status === "ACTIVE" ? "fa-user-slash" : "fa-user-check"} me-1`}></i>
                  {member.status === "ACTIVE" ? "Disable User" : "Enable User"}
                </button>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function Team() {
  const { user } = useAuth();
  const canViewUsers = hasPermission(user, "can_view_users");
  const canAddUsers = hasPermission(user, "can_add_users");
  const canEditUsers = hasPermission(user, "can_edit_users");

  const [members, setMembers] = useState([]);
  const [permissionOptions, setPermissionOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [createdUserInfo, setCreatedUserInfo] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "NORMAL",
    temporary_password: "",
    confirm_temporary_password: "",
    permissions: [],
  });

  async function loadTeam() {
    setLoading(true);
    try {
      const requests = [api.get("/company-users")];
      if (canViewUsers) {
        requests.push(api.get("/company-users/permissions"));
      }

      const [usersRes, permissionsRes] = await Promise.all(requests);
      setMembers(usersRes.data.data || []);
      setPermissionOptions(permissionsRes?.data?.data || []);
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to load workspace users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTeam();
  }, [canViewUsers]);

  const canAssignPermissions = useMemo(
    () => canAddUsers && canViewUsers && form.role !== "MASTER",
    [canAddUsers, canViewUsers, form.role]
  );

  const togglePermission = (permissionKey) => {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permissionKey)
        ? current.permissions.filter((value) => value !== permissionKey)
        : [...current.permissions, permissionKey],
    }));
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    if (!form.name || !form.email || !form.temporary_password) {
      toast.error("Name, email, and temporary password are required");
      return;
    }
    if (form.temporary_password !== form.confirm_temporary_password) {
      toast.error("Temporary passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post("/company-users", {
        name: form.name,
        email: form.email,
        role: form.role,
        temporary_password: form.temporary_password,
        permissions: form.permissions,
      });
      toast.success(res.data.message || "User created");
      setCreatedUserInfo({ email: form.email, temporary_password: form.temporary_password });
      setForm({ name: "", email: "", role: "NORMAL", temporary_password: "", confirm_temporary_password: "", permissions: [] });
      await loadTeam();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  const masters = members.filter((member) => member.role === "MASTER");
  const others = members.filter((member) => member.role !== "MASTER");

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Manage your workspace users, roles, and access permissions."
        icon="fa-solid fa-user-group"
      />

      <div className="row g-4">
        <div className="col-12 col-xl-5">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h3 className="h6 mb-3">
                <i className="fa-solid fa-user-plus me-2 text-primary"></i>Add Team Member
              </h3>

              <form onSubmit={handleCreateUser}>
                <div className="mb-3">
                  <label className="form-label small fw-medium">Full name</label>
                  <input
                    className="form-control"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="Team member name"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-medium">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    placeholder="member@company.com"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-medium">Role</label>
                  <select
                    className="form-select"
                    value={form.role}
                    onChange={(event) => setForm({ ...form, role: event.target.value, permissions: [] })}
                  >
                    <option value="NORMAL">Normal User</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-medium">Temporary Password</label>
                  <input
                    type="password"
                    className="form-control"
                    value={form.temporary_password}
                    onChange={(event) => setForm({ ...form, temporary_password: event.target.value })}
                    placeholder="Share this once with the user"
                  />
                  <div className="form-text">User will be forced to change this on first login.</div>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-medium">Confirm Temporary Password</label>
                  <input
                    type="password"
                    className="form-control"
                    value={form.confirm_temporary_password}
                    onChange={(event) => setForm({ ...form, confirm_temporary_password: event.target.value })}
                    placeholder="Repeat temporary password"
                  />
                </div>

                {canAssignPermissions && (
                  <div className="mb-3">
                    <label className="form-label small fw-medium">Initial Permissions</label>
                    <div className="border rounded p-3 bg-body-tertiary">
                      <PermissionChecklist
                        permissionOptions={permissionOptions}
                        selectedPermissions={form.permissions}
                        onToggle={togglePermission}
                        inputPrefix="new-user"
                      />
                    </div>
                  </div>
                )}

                <button type="submit" className="btn btn-primary w-100" disabled={!canAddUsers || submitting}>
                  {submitting ? <><i className="fa-solid fa-spinner fa-spin me-2"></i>Creating...</> : "Create User"}
                </button>
              </form>

              {createdUserInfo && (
                <div className="alert alert-info mt-3 mb-0">
                  <div className="fw-semibold mb-1">
                    <i className="fa-solid fa-circle-check me-1"></i>Share these login details once
                  </div>
                  <div className="small"><strong>Email:</strong> {createdUserInfo.email}</div>
                  <div className="small"><strong>Temporary password:</strong> {createdUserInfo.temporary_password}</div>
                  <button type="button" className="btn btn-sm btn-outline-secondary mt-2" onClick={() => setCreatedUserInfo(null)}>
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-7">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <div>
                  <h3 className="h6 mb-0">
                    <i className="fa-solid fa-users me-2 text-primary"></i>Workspace Users
                  </h3>
                  <small className="text-muted">
                    {masters.length} master · {others.length} normal
                  </small>
                </div>
                <button type="button" className="btn btn-outline-primary btn-sm" onClick={loadTeam}>
                  <i className="fa-solid fa-rotate me-1"></i>Refresh
                </button>
              </div>

              {loading ? (
                <div className="text-center py-5 text-muted">
                  <i className="fa-solid fa-spinner fa-spin fa-2x mb-2"></i>
                  <p>Loading users...</p>
                </div>
              ) : members.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="fa-solid fa-users-slash fa-2x mb-2"></i>
                  <p>No users yet. Add one using the form.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle team-table mb-0">
                    <thead>
                      <tr>
                        <th></th>
                        <th>User</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Permissions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((member) => {
                        const isExpanded = expandedId === member.id;
                        return [
                          <tr
                            key={`row-${member.id}`}
                            className={`team-row${isExpanded ? " team-row-active" : ""}`}
                            onClick={() => setExpandedId(isExpanded ? null : member.id)}
                            style={{ cursor: "pointer" }}
                          >
                            <td style={{ width: 32 }}>
                              <i className={`fa-solid fa-chevron-${isExpanded ? "down" : "right"} text-muted small`}></i>
                            </td>
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                <div className="team-avatar-sm">{avatarLetter(member.name)}</div>
                                <div>
                                  <div className="fw-semibold small">{member.name}</div>
                                  <div className="text-muted" style={{ fontSize: "0.72rem" }}>{member.email}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${roleBadge(member.role)}`}>{member.role}</span>
                            </td>
                            <td>
                              <span className={`badge ${statusBadge(member.status)}`}>{member.status}</span>
                            </td>
                            <td>
                              {member.role === "MASTER" ? (
                                <span className="small text-muted">Full access</span>
                              ) : member.permissions.length > 0 ? (
                                <span className="small text-muted">{member.permissions.length} permission{member.permissions.length !== 1 ? "s" : ""}</span>
                              ) : (
                                <span className="small text-danger">None</span>
                              )}
                            </td>
                          </tr>,
                          isExpanded && (
                            <UserDetailRow
                              key={`detail-${member.id}`}
                              member={member}
                              permissionOptions={permissionOptions}
                              colSpan={5}
                              onRefresh={loadTeam}
                              currentUserId={user?.id}
                              canViewUsers={canViewUsers}
                              canEditUsers={canEditUsers}
                            />
                          ),
                        ];
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
