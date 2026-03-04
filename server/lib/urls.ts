export function lotCanonicalUrl(lotId: string, date: string): string {
  return `https://acme.internal/parking/lots/${lotId}?date=${date}`;
}
