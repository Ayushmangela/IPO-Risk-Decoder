/** Pulls the first few standalone numeric/percentage/currency figures out of a prose string,
 * so a dense paragraph can be summarized as scannable callouts without inventing any numbers. */
export function extractFigures(text, max = 3) {
  if (!text) return [];
  const pattern = /(₹|\$)?\s?\d[\d,]*(\.\d+)?\s?(%|percent|trillion|billion|million|crore|lakh)?/gi;
  const matches = (text.match(pattern) || []).map((m) => m.trim());
  const isBareYear = (m) => /^(19|20)\d{2}$/.test(m.replace(/,$/, ''));
  const hasUnit = (m) => /(₹|\$|%|percent|trillion|billion|million|crore|lakh)/i.test(m);

  const dedupe = (list) => {
    const seen = new Set();
    return list.filter((m) => {
      if (seen.has(m) || !/\d/.test(m) || /^\d$/.test(m)) return false;
      seen.add(m);
      return true;
    });
  };

  // Prefer figures with a currency symbol or magnitude unit; only fall back to bare
  // numbers (excluding plain calendar years) if that isn't enough to fill the quota.
  const primary = dedupe(matches.filter(hasUnit));
  const fallback = dedupe(matches.filter((m) => !hasUnit(m) && !isBareYear(m)));
  return [...primary, ...fallback].slice(0, max);
}

export function formatSeverity(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(2);
}
