import assert from 'node:assert/strict'
import test from 'node:test'
import { safeAdminRedirect } from './safeAdminRedirect.js'

test('accepts a normalized same-origin admin path', () => {
    assert.equal(safeAdminRedirect('/admin/reservations?page=2', 'https://admin.example.com'), '/admin/reservations?page=2')
})

test('rejects external, traversal, encoded, and malformed redirects', () => {
    const origin = 'https://admin.example.com'
    for (const value of [
        '//evil.com',
        '/admin/../',
        'https://evil.com',
        '/admin/%2e%2e/',
        '/admin/%252f%252fevil.com',
        '/admin//evil.com',
        '/admin\\..\\',
        '/administrator',
    ]) {
        assert.equal(safeAdminRedirect(value, origin), null, value)
    }
})
