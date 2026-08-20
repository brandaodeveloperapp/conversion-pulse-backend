import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsNotBeforeConstraint } from './is-not-before.validator';

import { CHANNELS, Channel } from '../../../../domain/model/channel';
import { GRANULARITIES } from '../../../../domain/model/granularity';
import type { Granularity } from '../../../../domain/model/granularity';

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
  @ValidateIf((dto: ConversionQueryDto) => dto.from !== undefined)
  @IsNotBeforeConstraint('from')
  to?: string;

  @ApiPropertyOptional({ enum: GRANULARITIES, default: 'day' })
  @IsOptional()
  @IsIn(GRANULARITIES)
  granularity: Granularity = 'day';

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
