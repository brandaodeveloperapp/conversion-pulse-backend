import {
  ConversionCounts,
  ConversionPoint,
  ConversionTotals,
} from '../model/conversion-point';

const RATE_PRECISION = 6;

/** Razão entre numerador e denominador. Null quando não há denominador — um
 * período sem envio não teve taxa zero, ele não tem taxa. */
export function ratio(numerator: number, denominator: number): number | null {
  if (denominator === 0) {
    return null;
  }
  return Number((numerator / denominator).toFixed(RATE_PRECISION));
}

export function toConversionPoint(counts: ConversionCounts): ConversionPoint {
  return {
    ...counts,
    conversionRate: ratio(counts.converted, counts.sent),
    openRate: ratio(counts.opened, counts.delivered),
  };
}

export function totalsOf(
  points: readonly ConversionCounts[],
): ConversionTotals {
  const sum = points.reduce(
    (acc, point) => ({
      sent: acc.sent + point.sent,
      converted: acc.converted + point.converted,
      delivered: acc.delivered + point.delivered,
    }),
    { sent: 0, converted: 0, delivered: 0 },
  );

  return { ...sum, conversionRate: ratio(sum.converted, sum.sent) };
}
