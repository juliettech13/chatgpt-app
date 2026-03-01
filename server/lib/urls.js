export function lotCanonicalUrl(lotId, date) {
  const safeDate = encodeURIComponent(date);
  const safeLotId = encodeURIComponent(lotId);
  return `https://acme.internal/parking/lots/${safeLotId}?date=${safeDate}`;
}

