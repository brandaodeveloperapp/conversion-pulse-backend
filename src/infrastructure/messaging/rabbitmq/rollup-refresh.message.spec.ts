import {
  buildRollupRefreshMessage,
  parseRollupRefreshMessage,
} from './rollup-refresh.message';

function toBuffer(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value), 'utf8');
}

describe('buildRollupRefreshMessage', () => {
  it('builds a message with an ISO requestedAt and concurrently true', () => {
    const message = buildRollupRefreshMessage('scheduled');

    expect(message.reason).toBe('scheduled');
    expect(message.concurrently).toBe(true);
    expect(Number.isNaN(Date.parse(message.requestedAt))).toBe(false);
  });
});

describe('parseRollupRefreshMessage', () => {
  it('round-trips a message built by buildRollupRefreshMessage', () => {
    const built = buildRollupRefreshMessage('manual');
    const parsed = parseRollupRefreshMessage(toBuffer(built));
    expect(parsed).toEqual(built);
  });

  it('throws on malformed JSON', () => {
    expect(() =>
      parseRollupRefreshMessage(Buffer.from('not json', 'utf8')),
    ).toThrow('not valid JSON');
  });

  it('throws when payload is not an object', () => {
    expect(() => parseRollupRefreshMessage(toBuffer('scheduled'))).toThrow(
      'must be an object',
    );
  });

  it('throws when requestedAt is missing or invalid', () => {
    expect(() =>
      parseRollupRefreshMessage(
        toBuffer({ reason: 'scheduled', concurrently: true }),
      ),
    ).toThrow('requestedAt');
  });

  it('throws when reason is not scheduled or manual', () => {
    expect(() =>
      parseRollupRefreshMessage(
        toBuffer({
          requestedAt: new Date().toISOString(),
          reason: 'urgent',
          concurrently: true,
        }),
      ),
    ).toThrow('reason');
  });

  it('throws when concurrently is not a boolean', () => {
    expect(() =>
      parseRollupRefreshMessage(
        toBuffer({
          requestedAt: new Date().toISOString(),
          reason: 'manual',
          concurrently: 'yes',
        }),
      ),
    ).toThrow('concurrently');
  });
});
