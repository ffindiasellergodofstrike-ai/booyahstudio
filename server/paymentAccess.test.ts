import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { FirebaseRtdb } from './firebaseRtdb';
import { easebuzzRetrieveHash, findPaidPurchase, isPaidOrderForProduct, matchesVerifiedEasebuzzPayment } from './paymentAccess';

const paidOrder = {
  id: 'order-1', orderNumber: 'order-1', userId: 'buyer-1', total: 550,
  status: 'PAID', paymentStatus: 'PAID', paymentEnvironment: 'live', paymentProvider: 'Easebuzz',
  transactionId: 'ebz-1', easebuzzTxnId: 'order-1',
  deliveryStatus: 'DELIVERED', downloadStatus: 'AVAILABLE',
  items: [{ productId: 'linknest-pro' }],
};

const purchase = {
  purchaseId: 'purchase-1', orderId: 'order-1', userId: 'buyer-1',
  productId: 'linknest-pro', accessStatus: 'active', downloadCount: 0, downloadLimit: 10,
};

test('order lookup never returns a global order belonging to another user', async (context) => {
  assert.equal(await FirebaseRtdb.getGlobalOrder('../users/buyer-1'), null);
  context.mock.method(FirebaseRtdb, 'getGlobalOrder', async () => paidOrder);
  assert.equal(await FirebaseRtdb.getUserOrderById('buyer-2', 'order-1'), null);
  assert.deepEqual(await FirebaseRtdb.getUserOrderById('buyer-1', 'order-1'), paidOrder);
});

test('active purchase alone cannot authorize an unpaid, revoked or manually marked paid order', async (context) => {
  let currentOrder: any = { ...paidOrder, paymentStatus: 'PENDING' };
  context.mock.method(FirebaseRtdb, 'getUserPurchases', async () => [purchase]);
  context.mock.method(FirebaseRtdb, 'getGlobalOrder', async () => currentOrder);

  assert.equal(await findPaidPurchase('buyer-1', 'linknest-pro'), null);
  currentOrder = { ...paidOrder, paymentStatus: 'FAILED' };
  assert.equal(await findPaidPurchase('buyer-1', 'linknest-pro'), null);
  currentOrder = { ...paidOrder, paymentProvider: undefined, transactionId: undefined };
  assert.equal(await findPaidPurchase('buyer-1', 'linknest-pro'), null);
  currentOrder = { ...paidOrder, deliveryStatus: 'REVOKED' };
  assert.equal(await findPaidPurchase('buyer-1', 'linknest-pro'), null);
  currentOrder = { ...paidOrder, status: 'PARTIALLY_REFUNDED' };
  assert.equal(await findPaidPurchase('buyer-1', 'linknest-pro'), null);
  currentOrder = paidOrder;
  assert.deepEqual(await findPaidPurchase('buyer-1', 'linknest-pro'), purchase);
});

test('download tokens stay bound to their buyer, purchase and order', async (context) => {
  context.mock.method(FirebaseRtdb, 'getUserPurchases', async () => [purchase]);
  context.mock.method(FirebaseRtdb, 'getGlobalOrder', async () => paidOrder);
  assert.equal(await findPaidPurchase('buyer-2', 'linknest-pro'), null);
  assert.equal(await findPaidPurchase('buyer-1', 'finora'), null);
  assert.equal(await findPaidPurchase('buyer-1', 'linknest-pro', 'other-purchase'), null);
  assert.equal(await findPaidPurchase('buyer-1', 'linknest-pro', 'purchase-1', 'other-order'), null);
  assert.equal(isPaidOrderForProduct({ ...paidOrder, userId: 'buyer-2' }, 'buyer-1', 'linknest-pro'), false);
});

test('Easebuzz retrieval uses merchant key, txnid and salt and verifies transaction identity and amount', () => {
  const expectedHash = crypto.createHash('sha512').update('merchant|order-1|private-salt').digest('hex');
  assert.equal(easebuzzRetrieveHash('merchant', 'order-1', 'private-salt'), expectedHash);
  const providerPayment = { status: 'success', txnid: 'order-1', amount: '550.00', easepayid: 'ebz-1' };
  assert.equal(matchesVerifiedEasebuzzPayment(providerPayment, paidOrder, 'merchant'), true);
  assert.equal(matchesVerifiedEasebuzzPayment({ ...providerPayment, status: 'failed' }, paidOrder, 'merchant'), false);
  assert.equal(matchesVerifiedEasebuzzPayment({ ...providerPayment, txnid: 'other-order' }, paidOrder, 'merchant'), false);
  assert.equal(matchesVerifiedEasebuzzPayment({ ...providerPayment, amount: '5.50' }, paidOrder, 'merchant'), false);
  assert.equal(matchesVerifiedEasebuzzPayment({ ...providerPayment, amount: undefined }, paidOrder, 'merchant'), false);
  assert.equal(matchesVerifiedEasebuzzPayment({ ...providerPayment, key: 'another-merchant' }, paidOrder, 'merchant'), false);
});
