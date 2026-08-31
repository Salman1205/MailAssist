import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFirstName, fillCustomerPlaceholders } from '../lib/personalize-template';

test('extractFirstName takes the first token of a full name', () => {
  assert.equal(extractFirstName('Enrique Espinoza'), 'Enrique');
  assert.equal(extractFirstName('agbelan esther'), 'Agbelan');
  assert.equal(extractFirstName('JOHN SMITH'), 'John');
});

test('extractFirstName preserves intentional internal casing', () => {
  assert.equal(extractFirstName('McDonald Reyes'), 'McDonald');
});

test('extractFirstName parses a raw "Name <addr>" From header', () => {
  // This is how customer info is actually stored (display name kept in the field).
  assert.equal(extractFirstName(null, 'Enrique Espinoza <enriqueespinoza1980@yahoo.com>'), 'Enrique');
  assert.equal(extractFirstName('Enrique Espinoza <e@x.com>', null), 'Enrique');
  assert.equal(extractFirstName(null, '"John Smith" <john@x.com>'), 'John');
});

test('extractFirstName derives from a cleanly-split email local-part', () => {
  assert.equal(extractFirstName(null, 'john.doe@example.com'), 'John');
  assert.equal(extractFirstName(null, 'mary_jane@example.com'), 'Mary');
});

test('extractFirstName falls back to "there" when no usable name', () => {
  // Concatenated blob with no clean split -> refuse to guess.
  assert.equal(extractFirstName('', 'enriqueespinoza1980@yahoo.com'), 'there');
  assert.equal(extractFirstName(null, null), 'there');
  // A name that is actually just the email address is not usable.
  assert.equal(extractFirstName('foo@bar.com'), 'there');
});

test('fillCustomerPlaceholders replaces the screenshot case', () => {
  const template = 'Hi [Customer Name],\n\nReceiving the same bulb for both beams is common.';
  const out = fillCustomerPlaceholders(template, { name: 'Enrique Espinoza' });
  assert.ok(out.startsWith('Hi Enrique,'));
  assert.ok(!out.includes('[Customer Name]'));
});

test('fillCustomerPlaceholders supports many placeholder spellings', () => {
  const c = { name: 'Enrique Espinoza' };
  assert.equal(fillCustomerPlaceholders('Hi [First Name]', c), 'Hi Enrique');
  assert.equal(fillCustomerPlaceholders('Hi {{first_name}}', c), 'Hi Enrique');
  assert.equal(fillCustomerPlaceholders('Hi {Name}', c), 'Hi Enrique');
  assert.equal(fillCustomerPlaceholders('Hi [NAME]', c), 'Hi Enrique');
  assert.equal(fillCustomerPlaceholders('Dear [Customer]', c), 'Dear Enrique');
});

test('fillCustomerPlaceholders leaves unrecognized placeholders untouched', () => {
  const out = fillCustomerPlaceholders('Hi [Customer Name], your [Order Number] shipped.', {
    name: 'Enrique Espinoza',
  });
  assert.equal(out, 'Hi Enrique, your [Order Number] shipped.');
});

test('fillCustomerPlaceholders uses fallback greeting when name missing', () => {
  const out = fillCustomerPlaceholders('Hi [Customer Name],', { email: 'x@y.com' });
  assert.equal(out, 'Hi there,');
});
