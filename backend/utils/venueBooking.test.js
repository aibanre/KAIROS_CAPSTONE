const test = require('node:test');
const assert = require('node:assert/strict');
const { findConflicts } = require('./venueBooking');

test('venue conflict checks use a locking read when requested', async () => {
  let query;
  const executor = {
    async query(sql) {
      query = sql;
      return [[]];
    },
  };

  await findConflicts(executor, 1, '2099-01-10', 480, 600, 0, null, { forUpdate: true });

  assert.match(query, /FOR UPDATE\s*$/);
});

test('venue availability checks remain non-locking by default', async () => {
  let query;
  const executor = {
    async query(sql) {
      query = sql;
      return [[]];
    },
  };

  await findConflicts(executor, 1, '2099-01-10', 480, 600);

  assert.doesNotMatch(query, /FOR UPDATE/);
});
