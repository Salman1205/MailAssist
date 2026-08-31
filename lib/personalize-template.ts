/**
 * Fills customer placeholders in quick-reply / template text.
 *
 * When an agent inserts a saved quick reply that contains a placeholder such as
 * "Hi [Customer Name]," we swap the placeholder for the customer's actual first
 * name so the agent doesn't have to edit it by hand. Only recognized name
 * placeholders are touched — any other placeholder (e.g. "[Order Number]") is
 * left exactly as written, so this is safe to run over arbitrary content.
 */

// Normalized placeholder keys we treat as "the customer's first name".
// Comparison is done after lowercasing and stripping spaces/underscores.
const NAME_PLACEHOLDER_KEYS = new Set<string>([
  'customername',
  'customerfirstname',
  'customerfirst',
  'firstname',
  'first',
  'fname',
  'name',
  'customer',
  'clientname',
  'clientfirstname',
  'recipientname',
  'recipientfirstname',
]);

/** Title-case a token only when it is written all-lower or all-upper, so a name
 *  the customer typed themselves (e.g. "McDonald") is preserved as-is. */
function normalizeCase(token: string): string {
  if (token === token.toLowerCase() || token === token.toUpperCase()) {
    return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
  }
  return token;
}

/** First name token from a clean display name ("Enrique Espinoza" -> "Enrique"). */
function firstNameFromDisplay(display: string): string | null {
  const token = display
    .split(/\s+/)[0]
    .replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}'’-]+$/gu, '');
  return token ? normalizeCase(token) : null;
}

/**
 * Split a value that may be a bare email, a bare name, or a raw From-style
 * header ("Enrique Espinoza <enrique@x.com>") into its display + address parts.
 * Customer info in the DB frequently arrives in the raw "Name <addr>" form, so
 * we must handle it here rather than assume a clean split.
 */
function parseNameAndAddress(raw?: string | null): { display: string; address: string } {
  const s = (raw || '').trim();
  if (!s) return { display: '', address: '' };

  const angle = s.match(/^\s*"?([^"<]*?)"?\s*<\s*([^>]+?)\s*>\s*$/);
  if (angle) return { display: angle[1].trim(), address: angle[2].trim() };

  if (s.includes('@')) return { display: '', address: s };
  return { display: s, address: '' };
}

/**
 * Try to make a plausible first name from an email local-part, but ONLY when it
 * splits cleanly on separators (john.doe -> John, mary_jane -> Mary). A single
 * concatenated blob like "enriqueespinoza1980" can't be split reliably, so we
 * refuse to guess and let the caller fall back to a neutral greeting.
 */
function firstNameFromEmail(address: string): string | null {
  const local = (address.split('@')[0] || '').trim();
  if (!local) return null;

  const parts = local
    .split(/[._\-+]+/)
    .map((p) => p.replace(/\d+/g, ''))
    .filter((p) => p.length >= 2 && /[A-Za-z]/.test(p));

  // Require an actual separator (more than one chunk) before trusting the split.
  if (parts.length >= 2) return normalizeCase(parts[0]);
  return null;
}

/**
 * Derive a usable first name from whatever customer info we have. Both inputs may
 * be a clean value OR a raw "Name <addr>" string, so we parse both and prefer, in
 * order: an explicit display name -> a display name embedded in the address field
 * -> a cleanly-splittable email local-part -> a neutral fallback greeting.
 */
export function extractFirstName(
  name?: string | null,
  email?: string | null,
  fallback: string = 'there',
): string {
  const fromName = parseNameAndAddress(name);
  const fromEmail = parseNameAndAddress(email);

  const display = fromName.display || fromEmail.display;
  if (display) {
    const first = firstNameFromDisplay(display);
    if (first) return first;
  }

  const address = fromName.address || fromEmail.address;
  const fromLocal = firstNameFromEmail(address);
  if (fromLocal) return fromLocal;

  // No usable name — neutral fallback keeps the greeting natural ("Hi there,").
  return fallback;
}

/**
 * Replace recognized customer-name placeholders in `content` with the customer's
 * first name. Unrecognized placeholders are left untouched.
 *
 * Supports [square], {curly} and {{double-curly}} wrappers, and is
 * case-insensitive with spaces or underscores inside, e.g. all of these become
 * the first name: [Customer Name], {{first_name}}, {First Name}, [NAME].
 */
export function fillCustomerPlaceholders(
  content: string,
  customer: { name?: string | null; email?: string | null },
  fallback: string = 'there',
): string {
  if (!content) return content;

  const firstName = extractFirstName(customer.name, customer.email, fallback);

  return content.replace(
    /[\[{]{1,2}\s*([A-Za-z][A-Za-z _]*?)\s*[\]}]{1,2}/g,
    (match, inner: string) => {
      const key = inner.toLowerCase().replace(/[\s_]/g, '');
      return NAME_PLACEHOLDER_KEYS.has(key) ? firstName : match;
    },
  );
}
