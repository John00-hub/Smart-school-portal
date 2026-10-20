/**
 * ============================================================================
 * SMARTSCHOOL — CENTRAL BRAND & SCHOOL CONFIGURATION
 * ============================================================================
 *
 * THREE DISTINCT IDENTITIES
 * -------------------------
 *   DEVELOPER  Midex Edits        — builds, supports and maintains the product
 *   PRODUCT    SmartSchool        — the reusable school-management platform
 *   SCHOOL     Greenfield Academy — the demonstration tenant shown to clients
 *
 * This file is the ONE place those three identities are defined. Components
 * import from here instead of hardcoding names or colours, so delivering a
 * branded portal to a new client means editing this file — not the dashboards,
 * authentication or academic logic.
 *
 * To onboard a client (e.g. Royal Scholars College), copy this file's
 * `DEMO_SCHOOL` into a new preset and point `activeSchool` at it. Nothing else
 * in the application needs to change.
 *
 * Runtime override: in live mode the school's own row in the `schools` table
 * (name, logo_url, primary_colour, accent_colour, motto) takes precedence over
 * the static defaults below — see docs/MIGRATION-STRATEGY.md. The values here
 * are the demonstration defaults used in demo mode and before hydration.
 * ============================================================================
 */

export interface SchoolBrand {
  /** Demonstration school shown to prospective clients. */
  schoolName: string
  /** Short form for tight spaces such as the sidebar logo. */
  schoolShortName: string
  motto: string
  logoUrl: string | null
  /**
   * Domain used when a record has no e-mail of its own and one must be
   * synthesised (e.g. a newly admitted student), so generated addresses
   * match the school's own domain rather than a hard-coded one.
   */
  emailDomain: string
  email: string
  phone: string
  address: string
  website: string
  /** Default academic session label. */
  academicSession: string
  /** Brand colours. Kept in sync with the CSS variables in index.css. */
  primaryColour: string
  secondaryColour: string
  accentColour: string
}

export interface ProductBrand {
  /** The software product. */
  productName: string
  productTagline: string
  /** The development company. */
  developerName: string
  developerAttribution: string
  supportEmail: string
  supportUrl: string
  copyrightYear: string
}

/**
 * UNSUPPLIED INFORMATION
 * ----------------------
 * The fields marked `PLACEHOLDER` below have NOT been provided by the client.
 * They are deliberately identifiable so nobody mistakes them for real contact
 * details during a demonstration. Replace them before showing this portal to a
 * prospect, or wire them to the `schools` table in live mode.
 */
export const PLACEHOLDER = 'Not supplied'

/**
 * True when a branding field holds a real value rather than the placeholder.
 * Contact blocks should use this so an unsupplied field is omitted from the
 * public interface instead of being shown to visitors as "Not supplied".
 */
export function isSupplied(value: string | null | undefined): boolean {
  return !!value && !value.includes(PLACEHOLDER)
}

export const DEMO_SCHOOL: SchoolBrand = {
  schoolName: 'Greenfield Academy',
  schoolShortName: 'Greenfield',
  motto: 'Knowledge · Integrity · Excellence',
  logoUrl: null,                       // no logo asset supplied yet
  emailDomain: 'greenfield.example',   // .example is reserved (RFC 2606)
  email: 'office@greenfield.example',
  phone: `+234 000 000 0000 (${PLACEHOLDER})`,
  address: `${PLACEHOLDER} — address not supplied`,
  website: `https://www.greenfield.example (${PLACEHOLDER})`,
  academicSession: '2024/2025',
  primaryColour: '#166534',
  secondaryColour: '#FFFFFF',
  accentColour: '#22C55E',
}

export const PRODUCT: ProductBrand = {
  productName: 'SmartSchool',
  productTagline: 'School Management Portal',
  developerName: 'Midex Edits',
  developerAttribution: 'Powered by Midex Edits',
  supportEmail: 'support@midexedits.com',
  supportUrl: 'https://midexedits.example',
  copyrightYear: String(new Date().getFullYear()),
}

/**
 * The school this deployment is branded for.
 * Point this at a different preset to re-skin the whole portal.
 */
export const activeSchool: SchoolBrand = DEMO_SCHOOL

/** Footer line, kept consistent everywhere it appears. */
export const copyrightLine =
  `© ${PRODUCT.copyrightYear} ${activeSchool.schoolName} | ${PRODUCT.developerAttribution}`

/** Browser <title>, mirrored in index.html for the pre-hydration paint. */
export const portalTitle = `${PRODUCT.productName} Portal | ${activeSchool.schoolName}`

/** Initials for the logo tile when no logo asset is supplied. */
/** Builds a school e-mail address from a local part (e.g. an admission no.). */
export function schoolEmail(localPart: string): string {
  const clean = localPart.trim().toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '')
  return `${clean}@${activeSchool.emailDomain}`
}

export const schoolInitials = activeSchool.schoolName
  .split(/\s+/)
  .filter(w => w.length > 2)
  .slice(0, 2)
  .map(w => w[0]?.toUpperCase() ?? '')
  .join('')

/**
 * Presets for future clients. Add one entry per school; nothing else changes.
 * Colours here must match the CSS variables if you override the theme.
 */
export const SCHOOL_PRESETS: Record<string, SchoolBrand> = {
  'greenfield-academy': DEMO_SCHOOL,
  // 'royal-scholars-college': { ...DEMO_SCHOOL, schoolName: 'Royal Scholars College', primaryColour: '#7C2D12' },
  // 'bright-future-international': { ...DEMO_SCHOOL, schoolName: 'Bright Future International School', primaryColour: '#1E3A8A' },
}
