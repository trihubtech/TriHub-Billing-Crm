import { numberToWords, round2 } from "./invoiceUtils";

export const GST_RATE_OPTIONS = [0, 0.25, 1.5, 3, 5, 12, 18, 28, 40];

export const GST_RATE_SELECT_OPTIONS = GST_RATE_OPTIONS.map((rate) => ({
  value: rate,
  label: `${formatTaxRate(rate)}%`,
}));

export const INDIAN_STATES = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
  { code: "96", name: "Foreign Country" },
  { code: "97", name: "Other Territory" },
  { code: "99", name: "Centre Jurisdiction" },
];

const STATE_BY_CODE = new Map(INDIAN_STATES.map((state) => [state.code, state]));
const STATE_BY_NAME = new Map(INDIAN_STATES.map((state) => [state.name.toLowerCase(), state]));

let invoiceItemCounter = 0;

function round3(value) {
  return Math.round(Number(value || 0) * 1000) / 1000;
}

export function formatTaxRate(value) {
  const numeric = Number(value || 0);
  if (Number.isInteger(numeric)) {
    return String(numeric);
  }
  return numeric.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export function normalizeCountry(value) {
  const text = String(value || "").trim();
  return text || "India";
}

export function isIndianCountry(value) {
  return normalizeCountry(value).toLowerCase() === "india";
}

export function normalizeStateCode(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  if (!digits) return null;
  return digits.padStart(2, "0").slice(-2);
}

export function findStateByCode(value) {
  const code = normalizeStateCode(value);
  if (!code) return null;
  return STATE_BY_CODE.get(code) || null;
}

export function findStateByName(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  return STATE_BY_NAME.get(text.toLowerCase()) || null;
}

export function deriveStateFromGstin(value) {
  const text = String(value || "").trim().toUpperCase();
  if (text.length < 2) return null;
  return findStateByCode(text.slice(0, 2));
}

export function calcExclusiveRate(rate, gstRate, priceIncludesGst) {
  const normalizedRate = round2(rate);
  const normalizedGstRate = Number(gstRate || 0);

  if (!priceIncludesGst || normalizedGstRate <= 0) {
    return normalizedRate;
  }

  return round2(normalizedRate / (1 + normalizedGstRate / 100));
}

function buildRateBreakup(gstRate, supplyType) {
  const normalizedGstRate = round2(gstRate);

  if (supplyType === "INTRA_STATE") {
    const halfRate = round3(normalizedGstRate / 2);
    return { cgstRate: halfRate, sgstRate: halfRate, igstRate: 0 };
  }

  return { cgstRate: 0, sgstRate: 0, igstRate: round3(normalizedGstRate) };
}

function allocateDiscounts(baseValues, discount) {
  const normalizedBaseValues = baseValues.map((value) => round2(value));
  const totalBaseValue = round2(normalizedBaseValues.reduce((sum, value) => sum + value, 0));
  const targetDiscount = Math.min(round2(discount), totalBaseValue);

  if (targetDiscount <= 0 || totalBaseValue <= 0) {
    return normalizedBaseValues.map(() => 0);
  }

  let remainingDiscount = targetDiscount;

  return normalizedBaseValues.map((baseValue, index) => {
    if (index === normalizedBaseValues.length - 1) {
      return round2(Math.min(baseValue, remainingDiscount));
    }

    const proportionalDiscount = round2(targetDiscount * (baseValue / totalBaseValue));
    const appliedDiscount = round2(Math.min(baseValue, remainingDiscount, proportionalDiscount));
    remainingDiscount = round2(remainingDiscount - appliedDiscount);
    return appliedDiscount;
  });
}

export function createInvoiceItemDraft() {
  invoiceItemCounter += 1;
  return {
    _key: `gst_row_${Date.now()}_${invoiceItemCounter}`,
    product_id: "",
    product: null,
    hsn_sac_code: "",
    product_type: "",
    rate: "",
    quantity: "",
    baseValue: 0,
    discountValue: 0,
    taxableValue: 0,
    taxRate: 0,
    taxValue: 0,
    cgstRate: 0,
    cgstAmount: 0,
    sgstRate: 0,
    sgstAmount: 0,
    igstRate: 0,
    igstAmount: 0,
    totalValue: 0,
  };
}

export function calculateInvoicePreview({
  items,
  discount = 0,
  companyStateCode,
  placeOfSupplyStateCode,
  isExport = false,
  priceIncludesGst = false,
  internationalSupplyType = "EXPORT",
}) {
  const supplyType = isExport
    ? internationalSupplyType
    : normalizeStateCode(companyStateCode) === normalizeStateCode(placeOfSupplyStateCode)
      ? "INTRA_STATE"
      : "INTER_STATE";

  const seededItems = items.map((item) => {
    const rate = round2(Number(item.rate));
    const quantity = round2(Number(item.quantity));
    const taxRate = round2(Number(item.taxRate ?? item.tax_rate ?? 0));

    let exclusiveRate, baseValue, grossValue;

    if (priceIncludesGst && taxRate > 0) {
      grossValue = round2(rate * quantity);
      baseValue = round2(grossValue / (1 + taxRate / 100));
      exclusiveRate = round2(rate / (1 + taxRate / 100));
    } else {
      exclusiveRate = rate;
      baseValue = round2(exclusiveRate * quantity);
      grossValue = baseValue;
    }

    return {
      ...item,
      rate,
      quantity,
      taxRate,
      exclusiveRate,
      baseValue,
      grossValue,
    };
  });

  const allocatedDiscounts = allocateDiscounts(seededItems.map((item) => item.baseValue), discount);

  const calculatedItems = seededItems.map((item, index) => {
    const discountValue = allocatedDiscounts[index];
    const taxableValue = round2(item.baseValue - discountValue);
    const { cgstRate, sgstRate, igstRate } = buildRateBreakup(item.taxRate, supplyType);

    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
    let taxValue = 0;
    let totalValue = 0;

    if (priceIncludesGst) {
      if (discountValue <= 0) {
        totalValue = item.grossValue;
        taxValue = round2(totalValue - taxableValue);
      } else {
        totalValue = round2(taxableValue * (1 + item.taxRate / 100));
        taxValue = round2(totalValue - taxableValue);
      }
      if (igstRate > 0) {
        igstAmount = taxValue;
      } else if (cgstRate > 0 && sgstRate > 0) {
        cgstAmount = round2(taxValue / 2);
        sgstAmount = round2(taxValue - cgstAmount);
      }
    } else {
      cgstAmount = round2(taxableValue * (cgstRate / 100));
      sgstAmount = round2(taxableValue * (sgstRate / 100));
      igstAmount = round2(taxableValue * (igstRate / 100));
      taxValue = round2(cgstAmount + sgstAmount + igstAmount);
      totalValue = round2(taxableValue + taxValue);
    }

    return {
      ...item,
      rate: item.rate,
      baseValue: item.baseValue,
      discountValue,
      taxableValue,
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      igstRate,
      igstAmount,
      taxValue,
      totalValue,
    };
  });

  const subTotal = round2(calculatedItems.reduce((sum, item) => sum + item.baseValue, 0));
  const taxableTotal = round2(calculatedItems.reduce((sum, item) => sum + item.taxableValue, 0));
  const totalCgst = round2(calculatedItems.reduce((sum, item) => sum + item.cgstAmount, 0));
  const totalSgst = round2(calculatedItems.reduce((sum, item) => sum + item.sgstAmount, 0));
  const totalIgst = round2(calculatedItems.reduce((sum, item) => sum + item.igstAmount, 0));
  const totalTax = round2(totalCgst + totalSgst + totalIgst);
  const grandTotal = round2(taxableTotal + totalTax);

  return {
    supplyType,
    items: calculatedItems,
    totals: {
      subTotal,
      discount: round2(discount),
      taxableTotal,
      totalCgst,
      totalSgst,
      totalIgst,
      totalTax,
      roundOff: 0,
      grandTotal,
      amountInWords: numberToWords(grandTotal),
    },
  };
}
