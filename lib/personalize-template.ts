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

/**
 * Derive a usable first name from a customer's display name (preferred) or,
 * failing that, fall back to a neutral greeting word so a template never sends
 * a literal "[Customer Name]".
 */
export function extractFirstName(
  name?: string | null,
  email?: string | null,
  fallback: string = 'there',
): string {
  const clean = (name || '').trim();

  // A real display name that isn't just the email address.
  if (clean && !clean.includes('@')) {
    // First whitespace-delimited token, minus surrounding punctuation/quotes.
    const firstToken = clean
      .split(/\s+/)[0]
      .replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}'’-]+$/gu, '');
    if (firstToken) return normalizeCase(firstToken);
  }

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
