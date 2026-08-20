import { ListChannelsUseCase } from './list-channels.use-case';
import type { ConversionRepositoryPort } from '../../domain/port/conversion-repository.port';
import type { ChannelVolume } from '../../domain/model/conversion-point';

describe('ListChannelsUseCase', () => {
  it('returns the channel volumes the repository provides', async () => {
    const channels: ChannelVolume[] = [
      {
        channel: 'email',
        sent: 6608389,
        firstDay: '2024-01-01',
        lastDay: '2025-12-31',
      },
      {
        channel: 'wpp',
        sent: 1952,
        firstDay: '2024-01-07',
        lastDay: '2024-09-11',
      },
    ];
    const repo = {
      listChannels: jest.fn().mockResolvedValue(channels),
    } as unknown as ConversionRepositoryPort;

    const result = await new ListChannelsUseCase(repo).execute();

    expect(result).toBe(channels);
  });
});
