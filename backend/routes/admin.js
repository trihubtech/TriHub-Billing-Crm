const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { body, validationResult } = require("express-validator");
const { pool, logActivity } = require("../config/db");
const { requirePlatformAdmin } = require("../middleware/adminAuth");
const { activateSubscription, suspendSubscription } = require("../utils/subscriptions");


// FIXED: save QR images inside /platform folder
const qrUploadsDir = "/var/www/trihub-uploads/platform";

function ensurePlatformDir() {
  if (!fs.existsSync(qrUploadsDir)) {
    fs.mkdirSync(qrUploadsDir, { recursive: true });
  }
}

const qrStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensurePlatformDir();
    cb(null, qrUploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `payment_qr_${Date.now()}${ext}`);
  },
});

const qrUpload = multer({
  storage: qrStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;

    const allowedMimeTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ]);

    if (
      !allowed.test(path.extname(file.originalname)) ||
      !allowedMimeTypes.has(file.mimetype)
    ) {
      cb(
        new Error(
          "Only image files (JPG, PNG, GIF, WebP) are allowed for QR codes"
        )
      );
      return;
    }

    cb(null, true);
  },
});

function validationErrors(req, res) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json({
      ok: false,
      error: "Validation failed",
      details: errors.mapped(),
    });
  }

  return null;
}

router.get("/payment-qr", async (req, res, next) => {
  try {
    const [settings] = await pool.execute(
      "SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN ('payment_qr_image', 'payment_upi_id', 'payment_upi_mobile')"
    );

    const data = {
      qr_image_url: null,
      upi_id: null,
      upi_mobile: null,
    };

    for (const row of settings) {
      if (row.setting_key === "payment_qr_image") {
        data.qr_image_url = row.setting_value;
      }

      if (row.setting_key === "payment_upi_id") {
        data.upi_id = row.setting_value;
      }

      if (row.setting_key === "payment_upi_mobile") {
        data.upi_mobile = row.setting_value;
      }
    }

    return res.json({
      ok: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

router.use(requirePlatformAdmin);

router.post(
  "/payment-details",
  [
    body("upi_id").optional({ checkFalsy: true }).trim(),

    body("upi_mobile")
      .optional({ checkFalsy: true })
      .trim()
      .matches(/^\+\d{1,3}\s?\d{10}$/)
      .withMessage(
        "UPI Mobile must include a country code (e.g., +91) and 10 digits"
      ),
  ],

  async (req, res, next) => {
    const err = validationErrors(req, res);

    if (err) return;

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const { upi_id, upi_mobile } = req.body;

      const userId = req.authUserId || req.user.member_id;

      if (upi_id !== undefined) {
        await conn.execute(
          `INSERT INTO platform_settings (setting_key, setting_value, updated_by)
           VALUES ('payment_upi_id', ?, ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
          [upi_id, userId]
        );
      }

      if (upi_mobile !== undefined) {
        await conn.execute(
          `INSERT INTO platform_settings (setting_key, setting_value, updated_by)
           VALUES ('payment_upi_mobile', ?, ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
          [upi_mobile, userId]
        );
      }

      await logActivity(conn, {
        userId,
        type: "PAYMENT_DETAILS_UPDATED",
        description: "Payment UPI details updated by platform admin.",
      });

      await conn.commit();

      return res.json({
        ok: true,
        message: "Payment details updated successfully.",
      });
    } catch (error) {
      await conn.rollback();
      next(error);
    } finally {
      conn.release();
    }
  }
);

router.post(
  "/payment-qr",
  qrUpload.single("qr_image"),

  async (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "No QR code image uploaded",
      });
    }

    const conn = await pool.getConnection();

    const newPath = `/uploads/platform/${req.file.filename}`;

    try {
      await conn.beginTransaction();

      const [[oldSetting]] = await conn.execute(
        "SELECT setting_value FROM platform_settings WHERE setting_key = 'payment_qr_image'"
      );

      // FIXED: delete old QR image using new absolute uploads path
      if (oldSetting?.setting_value) {
        const oldAbsPath = path.join(
          "/var/www/trihub-uploads",
          oldSetting.setting_value.replace("/uploads/", "")
        );

        if (fs.existsSync(oldAbsPath)) {
          fs.unlinkSync(oldAbsPath);
        }
      }

      await conn.execute(
        `INSERT INTO platform_settings (setting_key, setting_value, updated_by)
         VALUES ('payment_qr_image', ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
        [newPath, req.authUserId || req.user.member_id]
      );

      await logActivity(conn, {
        userId: req.authUserId || req.user.member_id,
        type: "PAYMENT_QR_UPLOADED",
        description: "Payment QR code image updated by platform admin.",
        metadata: { path: newPath },
      });

      await conn.commit();

      return res.json({
        ok: true,
        message: "Payment QR code uploaded successfully.",
        data: {
          qr_image_url: newPath,
        },
      });
    } catch (error) {
      await conn.rollback();

      // FIXED: remove uploaded file if DB save fails
      const absNewPath = path.join(
        "/var/www/trihub-uploads",
        newPath.replace("/uploads/", "")
      );

      if (fs.existsSync(absNewPath)) {
        fs.unlinkSync(absNewPath);
      }

      next(error);
    } finally {
      conn.release();
    }
  }
);

router.delete("/payment-qr", async (req, res, next) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [[oldSetting]] = await conn.execute(
      "SELECT setting_value FROM platform_settings WHERE setting_key = 'payment_qr_image'"
    );

    // FIXED: delete old QR image using new uploads location
    if (oldSetting?.setting_value) {
      const oldAbsPath = path.join(
        "/var/www/trihub-uploads",
        oldSetting.setting_value.replace("/uploads/", "")
      );

      if (fs.existsSync(oldAbsPath)) {
        fs.unlinkSync(oldAbsPath);
      }
    }

    await conn.execute(
      "DELETE FROM platform_settings WHERE setting_key = 'payment_qr_image'"
    );

    await logActivity(conn, {
      userId: req.authUserId || req.user.member_id,
      type: "PAYMENT_QR_DELETED",
      description: "Payment QR code image removed by platform admin.",
    });

    await conn.commit();

    return res.json({
      ok: true,
      message: "Payment QR code removed.",
    });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
});

module.exports = router;