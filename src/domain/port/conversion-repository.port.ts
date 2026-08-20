import {
  ChannelVolume,
  ConversionCounts,
  DateRange,
} from '../model/conversion-point';
import { Granularity } from '../model/granularity';

export interface TimeseriesCriteria {
  readonly range: DateRange;
  readonly granularity: Granularity;
  readonly channels: readonly string[] | null;
  readonly conversionStatuses: readonly number[];
}

export interface TimeseriesResult {
  readonly counts: readonly ConversionCounts[];
  readonly queryMs: number;
}

export const CONVERSION_REPOSITORY = Symbol('CONVERSION_REPOSITORY');

export interface ConversionRepositoryPort {
  findTimeseries(criteria: TimeseriesCriteria): Promise<TimeseriesResult>;
  findBounds(): Promise<DateRange>;
  listChannels(): Promise<ChannelVolume[]>;
}
