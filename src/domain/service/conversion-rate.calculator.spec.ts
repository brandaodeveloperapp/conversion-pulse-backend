import {
  ratio,
  toConversionPoint,
  totalsOf,
} from './conversion-rate.calculator';
import type { ConversionCounts } from '../model/conversion-point';

function counts(overrides: Partial<ConversionCounts> = {}): ConversionCounts {
  return {
    period: '2025-06-01',
    channel: 'email',
    sent: 100,
    converted: 10,
    delivered: 90,
    opened: 20,
    viewed: 5,
    ...overrides,
  };
}

describe('ratio', () => {
  it('returns null when the denominator is zero', () => {
    expect(ratio(10, 0)).toBeNull();
  });

  it('divides numerator by denominator', () => {
    expect(ratio(10, 100)).toBe(0.1);
  });

  it('rounds to six decimal places', () => {
    expect(ratio(1, 3)).toBe(0.333333);
  });
});

describe('totalsOf', () => {
  it('sums sent, converted and delivered across points', () => {
    const totals = totalsOf([
      counts({ sent: 100, converted: 10, delivered: 90 }),
      counts({ sent: 50, converted: 5, delivered: 40 }),
    ]);

    expect(totals).toEqual({
      sent: 150,
      converted: 15,
      delivered: 130,
      conversionRate: ratio(15, 150),
    });
  });

  it('returns a null conversionRate when total sent is zero', () => {
    const totals = totalsOf([counts({ sent: 0, converted: 0, delivered: 0 })]);

    expect(totals.conversionRate).toBeNull();
  });

  it('returns zeroed totals for an empty list', () => {
    expect(totalsOf([])).toEqual({
      sent: 0,
      converted: 0,
      delivered: 0,
      conversionRate: null,
    });
  });
});

describe('toConversionPoint', () => {
  it('computes conversionRate and openRate from the counts', () => {
    const point = toConversionPoint(
      counts({ sent: 100, converted: 10, delivered: 90, opened: 9 }),
    );

    expect(point.conversionRate).toBe(ratio(10, 100));
    expect(point.openRate).toBe(ratio(9, 90));
  });

  it('preserves the original count fields', () => {
    const input = counts();
    const point = toConversionPoint(input);

    expect(point).toMatchObject(input);
  });

  it('sets conversionRate to null when sent is zero', () => {
    const point = toConversionPoint(counts({ sent: 0, converted: 0 }));

    expect(point.conversionRate).toBeNull();
  });

  it('sets openRate to null when delivered is zero', () => {
    const point = toConversionPoint(counts({ delivered: 0, opened: 0 }));

    expect(point.openRate).toBeNull();
  });
});
