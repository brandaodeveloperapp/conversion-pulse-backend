import { ApiProperty } from '@nestjs/swagger';
import type { Granularity } from '../../../../domain/model/granularity';

export class ChannelVolumeDto {
  @ApiProperty({ example: 'email' }) channel!: string;
  @ApiProperty({ example: 6608389 }) sent!: number;
  @ApiProperty({ example: '2024-01-01' }) firstDay!: string;
  @ApiProperty({ example: '2025-12-31' }) lastDay!: string;
}

export class ConversionPointDto {
  @ApiProperty({ example: '2025-06-01' }) period!: string;
  @ApiProperty({ example: 'email' }) channel!: string;

  @ApiProperty({ example: 12043, description: 'Total de envios no período.' })
  sent!: number;

  @ApiProperty({
    example: 41,
    description: 'Envios que atingiram um status de conversão.',
  })
  converted!: number;

  @ApiProperty({
    example: 11890,
    description: 'Envios não recusados pelo provedor.',
  })
  delivered!: number;

  @ApiProperty({ example: 231 }) opened!: number;
  @ApiProperty({ example: 18 }) viewed!: number;

  @ApiProperty({
    example: 0.0034,
    nullable: true,
    description: 'converted / sent. Null quando sent = 0.',
  })
  conversionRate!: number | null;

  @ApiProperty({
    example: 0.0192,
    nullable: true,
    description: 'opened / delivered. Null quando delivered = 0.',
  })
  openRate!: number | null;
}

export class ConversionTotalsDto {
  @ApiProperty() sent!: number;
  @ApiProperty() converted!: number;
  @ApiProperty() delivered!: number;
  @ApiProperty({ type: Number, nullable: true }) conversionRate!: number | null;
}

export class ConversionMetaDto {
  @ApiProperty({ example: '2025-01-01' }) from!: string;
  @ApiProperty({ example: '2025-12-31' }) to!: string;
  @ApiProperty({ enum: ['day', 'week', 'month'] }) granularity!: Granularity;
  @ApiProperty({ type: [String] }) channels!: string[];
  @ApiProperty({ type: [Number] }) conversionStatuses!: number[];

  @ApiProperty({
    example: 3,
    description: 'Tempo da consulta no banco, em ms.',
  })
  queryMs!: number;

  @ApiProperty({ example: false, description: 'Resposta veio do cache.' })
  cached!: boolean;

  @ApiProperty({
    example: 'conversion_daily',
    description: 'Origem dos dados servidos.',
  })
  source!: string;
}

export class ConversionResponseDto {
  @ApiProperty({ type: ConversionMetaDto }) meta!: ConversionMetaDto;
  @ApiProperty({ type: ConversionTotalsDto }) totals!: ConversionTotalsDto;
  @ApiProperty({ type: [ConversionPointDto] }) series!: ConversionPointDto[];
}
