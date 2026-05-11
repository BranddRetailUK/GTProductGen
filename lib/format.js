export function formatGbp(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP"
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDateTime(value) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
