import { RESPONSE_STATUS, statusColumns } from './response-status';

describe('statusColumns', () => {
  it('deduplicates by column, not by status id', () => {
    const columns = statusColumns([
      RESPONSE_STATUS.Valid,
      RESPONSE_STATUS.Valid,
      RESPONSE_STATUS.Opened,
    ]);

    expect(columns).toEqual(['valid', 'opened']);
  });

  it('ignores status ids outside the known map', () => {
    const columns = statusColumns([RESPONSE_STATUS.Valid, 999]);

    expect(columns).toEqual(['valid']);
  });

  it('returns an empty list for an empty input', () => {
    expect(statusColumns([])).toEqual([]);
  });
});
