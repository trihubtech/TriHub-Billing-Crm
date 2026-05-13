export const INDIA_TIME_ZONE = "Asia/Kolkata";

function parseDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  const text = String(value).trim();
  if (!text) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return new Date(`${text}T00:00:00+05:30`);
  }

  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(text)) {
    return new Date(`${text.replace(" ", "T")}+05:30`);
  }

  return new Date(text);
}

export function todayIndiaISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function formatIndiaDate(value, options = {}) {
  const date = parseDateTime(value);
  if (!date || Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-IN", {
    timeZone: INDIA_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...options,
  });
}

export function formatIndiaDateTime(value, options = {}) {
  const date = parseDateTime(value);
  if (!date || Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-IN", {
    timeZone: INDIA_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
}

export function formatIndiaTime(value, options = {}) {
  const date = parseDateTime(value);
  if (!date || Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-IN", {
    timeZone: INDIA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
}
