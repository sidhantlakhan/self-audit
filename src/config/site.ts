/**
 * Every business fact that is not yet confirmed lives here, so it can be
 * filled in once. Values marked "to be confirmed" match the approved designs
 * and are shown to visitors exactly as written until they are replaced.
 * Each value can also be overridden with the environment variable named
 * beside it, without a code change.
 */
// NEXT_PUBLIC_* values must be read with literal property access so Next.js
// can inline them into the browser bundle.
const or = (value: string | undefined, fallback: string) => value?.trim() || fallback;

export const site = {
  company: "Amalthea Consultancy",
  city: "Ahmedabad, Gujarat",

  // Contact — placeholders from the design, to be confirmed.
  contactEmail: or(process.env.NEXT_PUBLIC_CONTACT_EMAIL, "hello@amalthea.example"),
  contactPhone: or(process.env.NEXT_PUBLIC_CONTACT_PHONE, "+91 00000 00000"),

  // Tier pricing — "₹— (to be confirmed)" is the approved wording until prices are set.
  price: {
    scorecard: "Free",
    selfAudit: or(process.env.NEXT_PUBLIC_PRICE_SELF_AUDIT, "₹— (to be confirmed)"),
    consultantAudit: or(process.env.NEXT_PUBLIC_PRICE_CONSULTANT_AUDIT, "₹— (to be confirmed)"),
  },

  // Where client data is stored, as stated on the landing page and privacy notice.
  storageRegion: or(process.env.NEXT_PUBLIC_STORAGE_REGION, "India (to be confirmed)"),

  // Next-step links on the result page. When empty, the click is recorded as a
  // request and the team follows up on WhatsApp instead of opening a link.
  webinarUrl: or(process.env.NEXT_PUBLIC_WEBINAR_URL, ""),
  bookingUrl: or(process.env.NEXT_PUBLIC_BOOKING_URL, ""),
} as const;

/** Server-only operational limits. */
export const limits = {
  /** Scorecards a single device may start in 24 hours before the rate-limit screen. */
  startsPerDevicePerDay: Number(or(process.env.SCORECARD_STARTS_PER_DEVICE, "5")),
  /** Looser cap per network address, so one office can still take it several times. */
  startsPerIpPerDay: Number(or(process.env.SCORECARD_STARTS_PER_IP, "25")),
  /** How many times the background job retries a report after the AI writer fails. */
  maxReportAttempts: 5,
};
