




export function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}




const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS_W = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function convertHundreds(n) {
  if (n === 0) return "";
  if (n < 20)  return ONES[n];
  if (n < 100) return TENS_W[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
  return ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + convertHundreds(n % 100) : "");
}

function convertIndian(n) {
  if (n === 0)  return "";
  if (n < 1000) return convertHundreds(n);
  const crore = Math.floor(n / 10000000);
  const lakh  = Math.floor((n % 10000000) / 100000);
  const thou  = Math.floor((n % 100000) / 1000);
  const rest  = n % 1000;
  let r = "";
  if (crore) r += convertHundreds(crore) + " Crore ";
  if (lakh)  r += convertHundreds(lakh)  + " Lakh ";
  if (thou)  r += convertHundreds(thou)  + " Thousand ";
  if (rest)  r += convertHundreds(rest);
  return r.trim();
}

export function numberToWords(amount) {
  if (isNaN(amount) || amount < 0) return "";
  const rupees = Math.floor(amount);
  const paise  = Math.round((amount - rupees) * 100);
  if (rupees === 0 && paise === 0) return "Zero Rupees Only";
  let result = "";
  if (rupees > 0) result += convertIndian(rupees) + " Rupee" + (rupees > 1 ? "s" : "");
  if (paise  > 0) result += (rupees > 0 ? " and " : "") + convertIndian(paise) + " Paise";
  return result + " Only";
}




export function calcItemTotals(rate, quantity, taxRate) {
  const r = round2(Number(rate)     || 0);
  const q = round2(Number(quantity) || 0);
  const t = round2(Number(taxRate)  || 0);
  const value    = round2(r * q);
  const taxValue = round2(value * (t / 100));
  const total    = round2(value + taxValue);
  return { value, taxValue, totalValue: total };
}




export function calcInvoiceTotals(items, discount = 0) {
  const subTotal  = round2(items.reduce((s, i) => s + (i.value || 0), 0));
  const totalTax  = round2(items.reduce((s, i) => s + (i.taxValue || 0), 0));
  const rawGrand  = subTotal - round2(Number(discount) || 0) + totalTax;
  const grandTotal = round2(Math.round(rawGrand));
  const roundOff  = round2(grandTotal - rawGrand);
  const amountInWords = numberToWords(grandTotal);
  return { subTotal, totalTax, roundOff, grandTotal, amountInWords };
}




let _counter = 0;
export function newItemDraft() {
  return {
    _key: `row_${Date.now()}_${++_counter}`,
    product_id: "",
    product: null,
    rate: "",
    quantity: "",
    value: 0,
    taxRate: 0,
    taxValue: 0,
    totalValue: 0,
  };
}




export function formatCurrency(n) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
}

export function formatDate(str) {
  return formatIndiaDate(str);
}

export function todayISO() {
  return todayIndiaISO();
}




export function buildUpiUri({ upiId, payeeName, amount, invoiceNumber }) {
  const safeUpiId = String(upiId || "").trim();
  const safeName = String(payeeName || "TriHub").trim();
  const safeNote = String(invoiceNumber || "TriHub").trim();
  const safeAmount = round2(Number(amount) || 0);

  if (!safeUpiId || safeAmount <= 0) {
    return "";
  }

  const params = new URLSearchParams({
    pa: safeUpiId,
    pn: safeName,
    am: safeAmount.toFixed(2),
    cu: "INR",
    tn: `Invoice ${safeNote}`,
  });

  return `upi://pay?${params.toString()}`;
}
import { formatIndiaDate, todayIndiaISO } from "./time";
