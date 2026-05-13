import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import api from "../../utils/api";

const SCANNER_ELEMENT_ID = "trihub-barcode-scanner-region";
const SCAN_COOLDOWN_MS   = 1800;

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.QR_CODE,
];

/**
 * BarcodeScanner
 * Props: show, onClose, onScan(barcodeValue), lastResult
 */
export default function BarcodeScanner({ show, onClose, onScan, lastResult }) {
  const scannerRef   = useRef(null);
  const streamRef    = useRef(null);
  const isMountedRef = useRef(true);
  const lastScanRef  = useRef({ code: null, time: 0 });

  const [cameras,        setCameras]        = useState([]);
  const [activeCameraId, setActiveCameraId] = useState(null);
  const [scannerReady,   setScannerReady]   = useState(false);
  const [error,          setError]          = useState(null);

  // Manual barcode entry fallback
  const [manualCode,     setManualCode]     = useState("");
  const [manualLoading,  setManualLoading]  = useState(false);
  const manualInputRef = useRef(null);

  /* ── decoded callback with debounce ────────────────────────── */
  function handleDecoded(decoded) {
    if (!isMountedRef.current) return;
    const code = decoded.trim();
    const now  = Date.now();
    if (code === lastScanRef.current.code && now - lastScanRef.current.time < SCAN_COOLDOWN_MS) return;
    lastScanRef.current = { code, time: now };
    onScan(code);
  }

  /* ── camera lifecycle ──────────────────────────────────────── */
  useEffect(() => {
    if (!show) return;
    isMountedRef.current = true;
    lastScanRef.current  = { code: null, time: 0 };
    setManualCode("");

    async function startScanner() {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (!isMountedRef.current) return;

        if (!devices || devices.length === 0) {
          setError("No camera found on this device.");
          return;
        }

        setCameras(devices);
        const backCam = devices.find((d) => /back|rear|environment/i.test(d.label));
        const camId   = (backCam || devices[devices.length - 1]).id;
        setActiveCameraId(camId);

        const qr = new Html5Qrcode(SCANNER_ELEMENT_ID);
        scannerRef.current = qr;

        await qr.start(
          { deviceId: { exact: camId } },
          {
            fps: 10,
            qrbox: { width: 260, height: 100 },
            aspectRatio: 1.5,
            formatsToSupport: SUPPORTED_FORMATS,
            // NOTE: experimentalFeatures intentionally omitted — native BarcodeDetector
            // is strict about glare and fails on phone/screen-displayed barcodes.
            // ZXing JS fallback is more forgiving for all real-world scenarios.
          },
          handleDecoded,
          () => {}
        );

        if (!isMountedRef.current) {
          stopStream();
          qr.stop().catch(() => {});
          return;
        }

        const videoEl = document.querySelector(`#${SCANNER_ELEMENT_ID} video`);
        if (videoEl?.srcObject) streamRef.current = videoEl.srcObject;

        setScannerReady(true);
      } catch (err) {
        stopStream();
        if (isMountedRef.current) {
          setError(
            err?.message?.includes("Permission")
              ? "Camera permission denied. Please allow camera access and try again."
              : `Camera error: ${err?.message || "Unknown error"}`
          );
        }
      }
    }

    startScanner();

    return () => {
      isMountedRef.current = false;
      setScannerReady(false);
      setCameras([]);
      setActiveCameraId(null);
      setError(null);
      stopStream();
      const instance = scannerRef.current;
      scannerRef.current = null;
      if (instance) {
        Promise.resolve()
          .then(() => (instance.isScanning ? instance.stop() : Promise.resolve()))
          .catch(() => {})
          .finally(() => { try { instance.clear(); } catch (_) {} });
      }
    };
  }, [show]); // eslint-disable-line react-hooks/exhaustive-deps

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function switchCamera(newCamId) {
    const qr = scannerRef.current;
    if (!qr || newCamId === activeCameraId) return;
    try {
      if (qr.isScanning) await qr.stop();
      setActiveCameraId(newCamId);
      await qr.start(
        { deviceId: { exact: newCamId } },
        { fps: 10, qrbox: { width: 260, height: 100 }, aspectRatio: 1.5, formatsToSupport: SUPPORTED_FORMATS },
        handleDecoded,
        () => {}
      );
      const videoEl = document.querySelector(`#${SCANNER_ELEMENT_ID} video`);
      if (videoEl?.srcObject) streamRef.current = videoEl.srcObject;
    } catch (err) {
      setError(`Camera switch failed: ${err?.message}`);
    }
  }

  /* ── manual barcode submit ─────────────────────────────────── */
  async function handleManualSubmit(e) {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    setManualLoading(true);
    try {
      // Verify barcode exists before passing up
      await api.get(`/products/barcode/${encodeURIComponent(code)}`);
      onScan(code);
      setManualCode("");
      manualInputRef.current?.focus();
    } catch (err) {
      if (err?.response?.status === 404) {
        onScan(code); // let handleScan show the not-found toast
        setManualCode("");
      } else {
        onScan(code);
        setManualCode("");
      }
    } finally {
      setManualLoading(false);
    }
  }

  if (!show) return null;

  return (
    <>
      {/* backdrop */}
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1060 }}
        onClick={onClose}
      />

      {/* modal */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 1070,
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: "100%", maxWidth: 440,
            background: "#fff", borderRadius: 12,
            boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
            overflow: "hidden", pointerEvents: "auto",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── header ── */}
          <div style={{
            background: "linear-gradient(135deg,#0d6efd,#6610f2)",
            color: "#fff", padding: "10px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
              <i className="fa-solid fa-barcode" style={{ marginRight: 8 }} />
              Barcode Scanner
            </span>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.2)", border: "none",
                color: "#fff", borderRadius: 6, padding: "4px 12px",
                cursor: "pointer", fontSize: "0.82rem", fontWeight: 600,
              }}
            >
              ✕ Close
            </button>
          </div>

          {/* ── camera feed ── */}
          <div style={{ position: "relative", background: "#000" }}>
            <div id={SCANNER_ELEMENT_ID} style={{ width: "100%" }} />

            {!scannerReady && !error && (
              <div style={{
                position: "absolute", inset: 0, minHeight: 200,
                background: "rgba(0,0,0,0.82)", color: "#fff",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
              }}>
                <div className="spinner-border text-primary" style={{ width: 36, height: 36, marginBottom: 10 }} />
                <small>Starting camera…</small>
              </div>
            )}

            {error && (
              <div style={{
                background: "rgba(0,0,0,0.88)", color: "#fff",
                padding: 24, textAlign: "center", minHeight: 150,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
              }}>
                <i className="fa-solid fa-triangle-exclamation text-warning fa-2x" style={{ marginBottom: 10 }} />
                <p style={{ margin: 0, fontSize: "0.85rem" }}>{error}</p>
              </div>
            )}
          </div>

          {/* ── status bar ── */}
          <div style={{
            background: "#111827", color: "rgba(255,255,255,0.5)",
            textAlign: "center", padding: "4px 12px",
            fontSize: "0.68rem", letterSpacing: "0.05em",
          }}>
            {scannerReady
              ? <><i className="fa-solid fa-circle-dot text-danger" style={{ marginRight: 5, animation: "trihub-pulse 1.2s infinite" }} />LIVE — hold printed barcode steady within the frame</>
              : error ? "Camera unavailable" : "Initialising camera…"
            }
          </div>

          {/* ── tips ── */}
          {scannerReady && (
            <div style={{ background: "#fffbeb", borderBottom: "1px solid #fde68a", padding: "6px 14px" }}>
              <p style={{ margin: 0, fontSize: "0.7rem", color: "#92400e" }}>
                <i className="fa-solid fa-lightbulb me-1" />
                <strong>Tip:</strong> For best results use a <strong>printed barcode label</strong>. Phone/screen barcodes may not scan due to glare — use the manual entry below instead.
              </p>
            </div>
          )}

          {/* ── manual barcode entry (production fallback) ── */}
          <div style={{ padding: "10px 14px", background: "#f8f9fa", borderBottom: "1px solid #dee2e6" }}>
            <form onSubmit={handleManualSubmit} style={{ display: "flex", gap: 6 }}>
              <input
                ref={manualInputRef}
                type="text"
                className="form-control form-control-sm"
                placeholder="Or type / paste barcode number…"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                style={{ fontFamily: "monospace", letterSpacing: "0.05em", flex: 1 }}
                autoComplete="off"
                inputMode="numeric"
              />
              <button
                type="submit"
                className="btn btn-sm btn-primary"
                disabled={!manualCode.trim() || manualLoading}
                style={{ flexShrink: 0 }}
              >
                {manualLoading
                  ? <span className="spinner-border spinner-border-sm" />
                  : <><i className="fa-solid fa-arrow-right me-1" />Add</>
                }
              </button>
            </form>
          </div>

          {/* ── last scan result ── */}
          {lastResult && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 16px", borderTop: "1px solid #e9ecef",
              background:
                lastResult.status === "found"     ? "rgba(25,135,84,0.07)" :
                lastResult.status === "not_found" ? "rgba(220,53,69,0.07)" : "#f8f9fa",
            }}>
              {lastResult.status === "searching"
                ? <div className="spinner-border spinner-border-sm text-primary" style={{ flexShrink: 0 }} />
                : <i className={`fa-solid fa-${lastResult.status === "found" ? "circle-check text-success" : "circle-xmark text-danger"} fa-lg`} style={{ flexShrink: 0 }} />
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: "0.82rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {lastResult.status === "found"     ? lastResult.productName            :
                   lastResult.status === "not_found" ? "No product matched this barcode" : "Looking up…"}
                </div>
                <div style={{ fontSize: "0.68rem", color: "#6c757d", fontFamily: "monospace" }}>
                  {lastResult.code}
                </div>
              </div>
              <span style={{
                flexShrink: 0, padding: "2px 8px", borderRadius: 4,
                fontSize: "0.72rem", fontWeight: 600, color: "#fff",
                background:
                  lastResult.status === "found"     ? "#198754" :
                  lastResult.status === "not_found" ? "#dc3545" : "#6c757d",
              }}>
                {lastResult.status === "found" ? "Added ✓" : lastResult.status === "not_found" ? "Not found" : "…"}
              </span>
            </div>
          )}

          {/* ── multi-camera selector ── */}
          {cameras.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "#f8f9fa", borderTop: "1px solid #e9ecef" }}>
              <i className="fa-solid fa-camera text-muted" style={{ fontSize: "0.8rem" }} />
              <select
                className="form-select form-select-sm"
                value={activeCameraId || ""}
                onChange={(e) => switchCamera(e.target.value)}
              >
                {cameras.map((cam) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label || `Camera ${cam.id.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes trihub-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.2; }
        }
      `}</style>
    </>
  );
}
