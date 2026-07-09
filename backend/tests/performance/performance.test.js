process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert';
import { cacheService } from '../../src/services/cache.service.js';
import { getMemoryMetrics } from '../../src/utils/performance.util.js';
import { getPaginationBounds } from '../../src/utils/query.util.js';

test.describe('Production Performance Telemetry Tests', () => {
  test('cacheService manages caching lifecycle and invalidation keys', async () => {
    const cacheKey = 'test:perf:metric-key';
    const cacheData = { totalUsers: 450, activeSessions: 89 };

    // 1. Write to Cache
    await cacheService.set(cacheKey, cacheData, 10);

    // 2. Read from Cache
    const fetched = await cacheService.get(cacheKey);
    assert.deepStrictEqual(fetched, cacheData);

    // 3. Delete from Cache
    await cacheService.delete(cacheKey);
    const missing = await cacheService.get(cacheKey);
    assert.strictEqual(missing, null);
  });

  test('getMemoryMetrics reads system heap and rss metrics', () => {
    const mem = getMemoryMetrics();
    assert.ok(mem.rss > 0);
    assert.ok(mem.heapUsed > 0);
    assert.ok(mem.heapTotal > 0);
  });

  test('getPaginationBounds restricts limit thresholds to safe default/max bounds', () => {
    // 1. Check default boundary when missing
    const boundsEmpty = getPaginationBounds({});
    assert.strictEqual(boundsEmpty.take, 50);
    assert.strictEqual(boundsEmpty.skip, 0);

    // 2. Check maximum threshold bound enforcement
    const boundsHuge = getPaginationBounds({ limit: '1000', page: '2' });
    assert.strictEqual(boundsHuge.take, 250); // Hard maximum cap
    assert.strictEqual(boundsHuge.skip, 250);
  });
});
