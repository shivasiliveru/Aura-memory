/** Standard outcome factors, shared by the outcome dialog and learning extraction so
 * patterns use the same labels across memories (cleaner recall and Insights). */
export const WON_FACTOR_OPTIONS = [
  "Detailed Security Architecture",
  "Early Compliance Chapter",
  "Specific Implementation Timeline",
  "Quantified ROI / Payback Model",
  "Technical Depth & Integration Detail",
  "Customized Workflow Mapping",
  "Competitive & Transparent Pricing",
  "Named Workstream Leads",
];

export const LOST_FACTOR_OPTIONS = [
  "Generic Pricing Language",
  "Weak ROI Explanation",
  "Conceptual / Vague Implementation Plan",
  "Insufficient Technical Detail",
  "Generic Template Messaging",
  "Missing Compliance Evidence",
  "Lack of Customization",
  "Competitor Specialist Advantage",
];

const patternKey = (label: string) => label.toLowerCase().replace(/[^a-z0-9]/g, "");
const STANDARD = new Map(
  [...WON_FACTOR_OPTIONS, ...LOST_FACTOR_OPTIONS].map((label) => [patternKey(label), label]),
);

/**
 * Normalises pattern labels: variants of a standard label ("EarlyComplianceChapter",
 * "early compliance chapter") become the standard spelling, and duplicates are dropped.
 */
export function canonicalPatterns(labels: string[]): string[] {
  const seen = new Map<string, string>();
  for (const raw of labels) {
    const label = raw.trim();
    const key = patternKey(label);
    if (key && !seen.has(key)) seen.set(key, STANDARD.get(key) ?? label);
  }
  return Array.from(seen.values());
}
