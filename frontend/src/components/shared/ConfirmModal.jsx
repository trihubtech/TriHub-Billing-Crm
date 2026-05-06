

export default function ConfirmModal({
  show,
  title = "Confirm Delete",
  message = "Are you sure you want to delete this record? This action cannot be undone.",
  confirmLabel = "Delete",
  confirmVariant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!show) return null;

  return (
    <>
      <div className="modal-backdrop fade show" onClick={onCancel}></div>
      <div className="modal fade show d-block" tabIndex="-1" id="confirm-modal">
        <div className="modal-dialog modal-dialog-centered modal-sm">
          <div className="modal-content border-0 shadow">
            <div className="modal-header border-0 pb-0">
              <h6 className="modal-title fw-semibold">
                <i className="fa-solid fa-triangle-exclamation text-warning me-2"></i>
                {title}
              </h6>
              <button type="button" className="btn-close" onClick={onCancel} disabled={loading}></button>
            </div>
            <div className="modal-body text-muted" style={{ fontSize: "0.9rem" }}>
              {message}
            </div>
            <div className="modal-footer border-0 pt-0">
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className={`btn btn-sm btn-${confirmVariant}`}
                onClick={onConfirm}
                disabled={loading}
              >
                {loading ? (
                  <><span className="spinner-border spinner-border-sm me-1" /> Deleting…</>
                ) : (
                  <><i className="fa-solid fa-trash me-1"></i>{confirmLabel}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
