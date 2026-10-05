import test from 'node:test';
import assert from 'node:assert/strict';
import { selectCustomerCheckout } from '../config/checkout';
import { normalizeProductAssets } from '../../server/productCatalog';

test('Razorpay checkout requires configured keys and a known environment', () => {
 assert.equal(selectCustomerCheckout({}), null);
 assert.equal(selectCustomerCheckout({ razorpay: { configured: false, environment: 'live' } }), null);
 assert.equal(selectCustomerCheckout({ razorpay: { configured: true, environment: 'unknown' } }), null);
 for (const environment of ['test', 'live']) assert.equal(selectCustomerCheckout({ razorpay: { configured: true, environment } }), 'razorpay');
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
