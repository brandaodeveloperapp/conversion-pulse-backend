export interface ChannelVolume {
  readonly channel: string;
  readonly sent: number;
  readonly firstDay: string;
  readonly lastDay: string;
}

export interface ConversionCounts {
  readonly period: string;
  readonly channel: string;
  readonly sent: number;
  readonly converted: number;
  readonly delivered: number;
  readonly opened: number;
  readonly viewed: number;
}

export interface ConversionPoint extends ConversionCounts {
  readonly conversionRate: number | null;
  readonly openRate: number | null;
}

export interface ConversionTotals {
  readonly sent: number;
  readonly converted: number;
  readonly delivered: number;
  readonly conversionRate: number | null;
}

export interface DateRange {
  readonly from: string;
  readonly to: string;
}
