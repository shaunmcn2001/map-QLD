import { describe, it, expect } from 'vitest';
import { normalizeLotPlan } from './gis';

describe('normalizeLotPlan', () => {
  const cases: Array<[string, string[]]> = [
    ['3/RP67254', ['3/RP67254']],
    ['3RP67254', ['3/RP67254']],
    ['3 rp67254', ['3/RP67254']],
    [' 3  RP 67254 ', ['3/RP67254']],
    ['L2 RP53435', ['2/RP53435']],
    ['L2/RP53435', ['2/RP53435']],
    ['2/SP 12345', ['2/SP12345']],
    ['2sp12345', ['2/SP12345']],
    ['L10 sp0001', ['10/SP0001']],
    ['l10/sp0001', ['10/SP0001']],
    ['1/sp123', ['1/SP123']],
    ['1sp123', ['1/SP123']],
  ];

  cases.forEach(([input, expected]) => {
    it(`normalizes "${input}"`, () => {
      expect(normalizeLotPlan(input)).toEqual(expected);
    });
  });

  it('returns empty array for blank', () => {
    expect(normalizeLotPlan('')).toEqual([]);
  });
});
