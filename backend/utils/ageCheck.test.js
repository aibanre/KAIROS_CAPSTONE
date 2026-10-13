const assert = require('node:assert/strict');
const { validateAdultDateOfBirth } = require('./ageCheck');

const today = new Date('2026-10-10T08:00:00Z');

assert.equal(validateAdultDateOfBirth('2008-10-10', today).valid, true);
assert.equal(validateAdultDateOfBirth('2008-10-11', today).valid, false);
assert.equal(validateAdultDateOfBirth('2008-02-29', new Date('2026-02-28T08:00:00Z')).valid, false);
assert.equal(validateAdultDateOfBirth('2008-02-29', new Date('2026-03-01T08:00:00Z')).valid, true);
assert.equal(validateAdultDateOfBirth('2027-01-01', today).valid, false);
assert.equal(validateAdultDateOfBirth('not-a-date', today).valid, false);
assert.equal(validateAdultDateOfBirth('1800-01-01', today).valid, false);

console.log('ageCheck tests passed');
