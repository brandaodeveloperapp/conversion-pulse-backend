import { Inject, Injectable } from '@nestjs/common';
import { CONVERSION_REPOSITORY } from '../../domain/port/conversion-repository.port';
import type { ConversionRepositoryPort } from '../../domain/port/conversion-repository.port';
import { ChannelVolume } from '../../domain/model/conversion-point';

@Injectable()
export class ListChannelsUseCase {
  constructor(
    @Inject(CONVERSION_REPOSITORY)
    private readonly repository: ConversionRepositoryPort,
  ) {}

  execute(): Promise<ChannelVolume[]> {
    return this.repository.listChannels();
  }
}
