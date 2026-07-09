process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert';
import * as exportUtil from '../../src/utils/export.util.js';
import { ExportService } from '../../src/services/export.service.js';

test.describe('Export Engine Unit Tests', () => {
  const exportService = new ExportService();

  test('sanitizeCellValue prepends single quote on unsafe strings', () => {
    assert.strictEqual(exportUtil.sanitizeCellValue('=SUM(A1:A10)'), "'=SUM(A1:A10)");
    assert.strictEqual(exportUtil.sanitizeCellValue('+123'), "'+123");
    assert.strictEqual(exportUtil.sanitizeCellValue('-456'), "'-456");
    assert.strictEqual(exportUtil.sanitizeCellValue('@test'), "'@test");
    assert.strictEqual(exportUtil.sanitizeCellValue('normal text'), 'normal text');
    assert.strictEqual(exportUtil.sanitizeCellValue(123), 123);
  });

  test('maskSensitiveFields redacts keys matching passwords/tokens/OTP/secrets', () => {
    const raw = {
      email: 'user@mitcon.corp',
      password: 'mypassword123',
      smtp_password: 'smtpSecretPasswordValue',
      jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      otp: '123456',
      normalField: 'testValue'
    };

    const masked = exportUtil.maskSensitiveFields(raw);
    assert.strictEqual(masked.email, 'user@mitcon.corp');
    assert.strictEqual(masked.password, '[REDACTED]');
    assert.strictEqual(masked.smtp_password, '[REDACTED]');
    assert.strictEqual(masked.jwtToken, '[REDACTED]');
    assert.strictEqual(masked.otp, '[REDACTED]');
    assert.strictEqual(masked.normalField, 'testValue');
  });

  test('calculateSha256 computes consistent hashes', () => {
    const buf = Buffer.from('mitcon-ledger-test-payload');
    const hash1 = exportUtil.calculateSha256(buf);
    const hash2 = exportUtil.calculateSha256(buf);
    assert.strictEqual(hash1, hash2);
    assert.strictEqual(typeof hash1, 'string');
    assert.strictEqual(hash1.length, 64);
  });

  test('generateCSV outputs valid escaped comma separated rows', async () => {
    const report = {
      name: 'Test Report',
      format: 'CSV',
      refNumber: 'REP-101',
    };
    const dataset = [
      { name: 'Document A', classification: 'SECRET', size: 1024 },
      { name: 'Document B, Version 2', classification: 'RESTRICTED', size: 2048 }
    ];

    const buffer = await exportService.generateCSV(report, dataset);
    const text = buffer.toString('utf8');

    // First character should be BOM
    assert.ok(text.startsWith('\ufeff'));
    assert.ok(text.includes('name,classification,size'));
    assert.ok(text.includes('Document A,SECRET,1024'));
    assert.ok(text.includes('"Document B, Version 2",RESTRICTED,2048'));
  });
});
