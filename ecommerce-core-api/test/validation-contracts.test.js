const test=require('node:test');
const assert=require('node:assert/strict');
const rules=require('../dist/common/domain/quote-rules.js');

test('decimal quote quantities follow minimum, maximum, and step',()=>{
  assert.doesNotThrow(()=>rules.assertQuoteQuantity(2.5,0.5,10,0.5));
  assert.throws(()=>rules.assertQuoteQuantity(0,0.5,10,0.5));
  assert.throws(()=>rules.assertQuoteQuantity(-1,0.5,10,0.5));
  assert.throws(()=>rules.assertQuoteQuantity(0.25,0.5,10,0.5));
  assert.throws(()=>rules.assertQuoteQuantity(10.5,0.5,10,0.5));
  assert.throws(()=>rules.assertQuoteQuantity(0.75,0.5,10,0.5));
});

test('quote workflow permits only documented transitions',()=>{
  assert.doesNotThrow(()=>rules.assertStatusTransition('new','in_review'));
  assert.doesNotThrow(()=>rules.assertStatusTransition('new','cancelled'));
  assert.doesNotThrow(()=>rules.assertStatusTransition('quote_sent','accepted'));
  assert.doesNotThrow(()=>rules.assertStatusTransition('accepted','closed'));
  assert.throws(()=>rules.assertStatusTransition('new','accepted'));
  assert.throws(()=>rules.assertStatusTransition('closed','in_review'));
});

test('free text is normalized and link spam is rejected',()=>{
  assert.equal(rules.sanitizeText('<script>alert(1)</script>Hello',100),'alert(1)Hello');
  assert.doesNotThrow(()=>rules.assertSpamSafe('See https://example.com'));
  assert.throws(()=>rules.assertSpamSafe('https://a.test https://b.test https://c.test'));
});
