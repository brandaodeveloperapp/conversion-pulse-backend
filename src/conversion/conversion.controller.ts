import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChannelRow, ConversionService } from './conversion.service';
import { ConversionQueryDto } from './dto/conversion-query.dto';
import { ConversionResponseDto } from './dto/conversion-response.dto';

@ApiTags('conversion')
@Controller({ path: 'conversion', version: '1' })
export class ConversionController {
  constructor(private readonly conversion: ConversionService) {}

  @Get('timeseries')
  @ApiOperation({
    summary: 'Evolução temporal da taxa de conversão por canal.',
    description:
      'Servido a partir da view materializada conversion_daily. Aceita recorte de datas, ' +
      'granularidade (day/week/month), seleção de canais e quais status contam como conversão.',
  })
  @ApiOkResponse({ type: ConversionResponseDto })
  timeseries(
    @Query() query: ConversionQueryDto,
  ): Promise<ConversionResponseDto> {
    return this.conversion.timeseries(query);
  }

  @Get('channels')
  @ApiOperation({
    summary: 'Canais disponíveis com volume e intervalo de datas.',
  })
  channels(): Promise<ChannelRow[]> {
    return this.conversion.channels();
  }
}
