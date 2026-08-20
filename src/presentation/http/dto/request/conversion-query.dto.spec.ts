import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConversionQueryDto } from './conversion-query.dto';

function toDto(plain: Record<string, unknown>): ConversionQueryDto {
  return plainToInstance(ConversionQueryDto, plain);
}

describe('ConversionQueryDto', () => {
  it('transforms a comma-separated channels string into an array', async () => {
    const dto = toDto({ channels: 'email,mobile' });

    expect(dto.channels).toEqual(['email', 'mobile']);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid channel', async () => {
    const dto = toDto({ channels: 'carrier-pigeon' });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'channels')).toBe(true);
  });

  it('transforms a comma-separated conversionStatuses string into a numeric array', async () => {
    const dto = toDto({ conversionStatuses: '1,5' });

    expect(dto.conversionStatuses).toEqual([1, 5]);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a conversionStatuses value outside 1..6', async () => {
    const dto = toDto({ conversionStatuses: '7' });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'conversionStatuses')).toBe(true);
  });

  it('rejects an invalid granularity', async () => {
    const dto = toDto({ granularity: 'year' });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'granularity')).toBe(true);
  });

  it('defaults granularity to day', () => {
    const dto = toDto({});

    expect(dto.granularity).toBe('day');
  });

  it('applies defaults when the query is empty', async () => {
    const dto = toDto({});

    expect(dto.granularity).toBe('day');
    expect(dto.conversionStatuses).toEqual([1]);
    expect(dto.channels).toBeUndefined();
    expect(dto.from).toBeUndefined();
    expect(dto.to).toBeUndefined();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
