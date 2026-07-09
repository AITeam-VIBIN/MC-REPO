process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert';
import * as analyticsUtil from '../../src/utils/analytics.util.js';
import { AnalyticsService } from '../../src/services/analytics.service.js';

test.describe('Analytics Engine Unit Tests', () => {
  const service = new AnalyticsService();

  test('resolveDateRange maps text shortcuts to Date objects', () => {
    const rangeToday = service.resolveDateRange('TODAY');
    assert.ok(rangeToday.startDate instanceof Date);
    assert.ok(rangeToday.endDate instanceof Date);

    const rangeLast7 = service.resolveDateRange('LAST_7_DAYS');
    const diff = rangeLast7.endDate - rangeLast7.startDate;
    // Difference should be roughly 7 days in milliseconds
    assert.ok(diff >= 6.9 * 24 * 3600 * 1000);
  });

  test('formatLineChart formats points and sorts them chronologically', () => {
    const raw = [
      { day: '2026-07-05', value: 15 },
      { day: '2026-07-02', value: 10 },
      { day: '2026-07-08', value: 20 }
    ];

    const formatted = analyticsUtil.formatLineChart(raw);
    assert.strictEqual(formatted.length, 3);
    assert.deepStrictEqual(formatted[0], ['2026-07-02', 10]);
    assert.deepStrictEqual(formatted[1], ['2026-07-05', 15]);
    assert.deepStrictEqual(formatted[2], ['2026-07-08', 20]);
  });

  test('formatBarChart formats and sorts counts descending', () => {
    const raw = [
      { label: 'Engineering', count: 5 },
      { label: 'Management', count: 12 },
      { label: 'HR', count: 3 }
    ];

    const formatted = analyticsUtil.formatBarChart(raw);
    assert.strictEqual(formatted.length, 3);
    assert.deepStrictEqual(formatted[0], ['Management', 12]);
    assert.deepStrictEqual(formatted[1], ['Engineering', 5]);
    assert.deepStrictEqual(formatted[2], ['HR', 3]);
  });

  test('formatPieChart formats and computes percentages dynamically', () => {
    const raw = [
      { category: 'Active', count: 6 },
      { category: 'Archived', count: 4 }
    ];

    const formatted = analyticsUtil.formatPieChart(raw);
    assert.strictEqual(formatted.length, 2);
    assert.deepStrictEqual(formatted[0], ['Active', 60.00]);
    assert.deepStrictEqual(formatted[1], ['Archived', 40.00]);
  });
});
