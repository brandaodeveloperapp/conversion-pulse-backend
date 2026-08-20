import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { GetConversionTimeseriesUseCase } from '../../../application/use-case/get-conversion-timeseries.use-case';
import { ListChannelsUseCase } from '../../../application/use-case/list-channels.use-case';
import { ConversionQueryDto } from '../dto/request/conversion-query.dto';
import {
  ChannelVolumeDto,
  ConversionResponseDto,
} from '../dto/response/conversion-response.dto';

@ApiTags('conversion')
@Controller({ path: 'conversion', version: '1' })
export class ConversionController {
  constructor(
    private readonly getTimeseries: GetConversionTimeseriesUseCase,
    private readonly listChannels: ListChannelsUseCase,
  ) {}

  @Get('timeseries')
  @ApiOperation({
    summary: 'Evolução temporal da taxa de conversão por canal.',
    description:
      'Servido a partir da view materializada conversion_daily, com cache de resposta no Redis. ' +
      'Aceita recorte de datas, granularidade, seleção de canais e quais status contam como conversão.',
  })
  @ApiOkResponse({ type: ConversionResponseDto })
  async timeseries(
    @Query() query: ConversionQueryDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<ConversionResponseDto> {
    const view = await this.getTimeseries.execute({
      from: query.from,
      to: query.to,
      granularity: query.granularity,
      channels: query.channels,
      conversionStatuses: query.conversionStatuses,
    });

    void reply.header('X-Cache', view.cached ? 'HIT' : 'MISS');

    return {
      meta: {
        from: view.range.from,
        to: view.range.to,
        granularity: view.granularity,
        channels: [...view.channels],
        conversionStatuses: [...view.conversionStatuses],
        queryMs: view.queryMs,
        cached: view.cached,
        source: 'conversion_daily',
      },
      totals: view.totals,
      series: [...view.series],
    };
  }

  @Get('channels')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({
    summary: 'Canais disponíveis com volume e intervalo de datas.',
  })
  @ApiOkResponse({ type: [ChannelVolumeDto] })
  channels(): Promise<ChannelVolumeDto[]> {
    return this.listChannels.execute();
  }
}
