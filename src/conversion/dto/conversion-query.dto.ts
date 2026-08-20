import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export enum Granularity {
  Day = 'day',
  Week = 'week',
  Month = 'month',
}

export const CHANNELS = ['email', 'mobile', 'wpp'] as const;
export type Channel = (typeof CHANNELS)[number];

const toList = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string'
    ? value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    : value;

const toIntList = ({ value }: { value: unknown }): unknown => {
  const list = toList({ value });
  return Array.isArray(list) ? list.map((v) => Number(v)) : list;
};

export class ConversionQueryDto {
  @ApiPropertyOptional({
    example: '2025-01-01',
    description: 'Início do intervalo (inclusivo).',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    example: '2025-12-31',
    description: 'Fim do intervalo (inclusivo).',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ enum: Granularity, default: Granularity.Day })
  @IsOptional()
  @IsEnum(Granularity)
  granularity: Granularity = Granularity.Day;

  @ApiPropertyOptional({
    isArray: true,
    enum: CHANNELS,
    description: 'Canais separados por vírgula. Omitido retorna todos.',
  })
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(CHANNELS, { each: true })
  channels?: Channel[];

  @ApiPropertyOptional({
    isArray: true,
    type: Number,
    default: [1],
    description: 'Status que contam como conversão. Padrão 1 (Válido).',
  })
  @IsOptional()
  @Transform(toIntList)
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(6, { each: true })
  conversionStatuses: number[] = [1];
}
