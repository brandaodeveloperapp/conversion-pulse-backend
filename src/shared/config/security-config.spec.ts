import { corsOrigin } from './cors-origin';
import { TRUSTED_PROXY_CIDRS, trustedProxies } from './trusted-proxies';

describe('corsOrigin', () => {
  it('denies cross-origin requests when nothing is configured', () => {
    expect(corsOrigin(undefined)).toBe(false);
    expect(corsOrigin('')).toBe(false);
    expect(corsOrigin('   ')).toBe(false);
  });

  it('never reflects an arbitrary origin back to the caller', () => {
    expect(corsOrigin('https://app.example.com')).toEqual([
      'https://app.example.com',
    ]);
  });

  it('accepts an explicit allowlist', () => {
    expect(corsOrigin('https://a.com, https://b.com')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('opens up only when a wildcard is asked for by name', () => {
    expect(corsOrigin('*')).toBe(true);
  });
});

describe('trustedProxies', () => {
  it('trusts private ranges only, never every hop', () => {
    const trusted = trustedProxies(undefined);

    expect(trusted).toEqual(TRUSTED_PROXY_CIDRS);
    expect(trusted).not.toBe(true);
    expect(TRUSTED_PROXY_CIDRS.some((cidr) => cidr.startsWith('0.0.0.0'))).toBe(
      false,
    );
  });

  it('accepts an explicit proxy list', () => {
    expect(trustedProxies('10.42.0.0/16, 127.0.0.1')).toEqual([
      '10.42.0.0/16',
      '127.0.0.1',
    ]);
  });

  it('falls back to the private ranges when handed a blank value', () => {
    expect(trustedProxies('  ')).toEqual(TRUSTED_PROXY_CIDRS);
  });
});
