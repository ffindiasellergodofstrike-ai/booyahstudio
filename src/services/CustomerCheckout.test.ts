import test from 'node:test';
import assert from 'node:assert/strict';
import { selectCustomerCheckout } from '../config/checkout';
import { normalizeProductAssets } from '../../server/productCatalog';

test('public checkout requires a configured live payment option', () => {
  assert.equal(selectCustomerCheckout({}), null);
  for (const environment of ['test', 'sandbox', '', 'unknown']) {
    assert.equal(selectCustomerCheckout({ easebuzz: { configured: true, environment } }), null);
  }
  assert.equal(selectCustomerCheckout({ easebuzz: { configured: false, environment: 'live' } }), null);
  assert.equal(selectCustomerCheckout({ easebuzz: { configured: true, environment: 'live' } }), 'easebuzz');
  assert.equal(selectCustomerCheckout({ easebuzz: { configured: true, environment: 'test' }, payu: { configured: true, environment: 'live' } }), 'payu');
  assert.equal(selectCustomerCheckout({ paddle: { configured: true, environment: 'live' } }, false), null);
});

test('legacy database descriptions and FAQs cannot restore obsolete store messaging', () => {
  const product = normalizeProductAssets({ id: 'example', description: 'Editable frontend. Gateway approval depends on your merchant account, final content and integration; it is not included with this template.', faqs: [
    { question: 'What happens in test checkout?', answer: 'Test payments do not issue files.' },
    { question: 'Does it include a backend?', answer: 'No, you must connect your own backend.' },
  ] });
  assert.equal(product.description, 'Editable frontend.');
  assert.match(product.faqs[0].answer, /email/);
  assert.doesNotMatch(JSON.stringify(product.faqs), /test checkout|test payments/i);
  assert.equal(product.faqs[1].answer, 'No, you must connect your own backend.');
});
