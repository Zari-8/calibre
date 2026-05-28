export function founderEndsAt(days = 90) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function isProFromDemoCookie(cookieValue?: string | null) {
  return cookieValue === 'founder_demo';
}
