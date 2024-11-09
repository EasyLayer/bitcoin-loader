import { Test, TestingModule } from '@nestjs/testing';
import { BitcoinLoaderModule } from '../loader.module';

describe('BitcoinLoaderModule', () => {
  let bitcoinLoaderModule: BitcoinLoaderModule;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [BitcoinLoaderModule],
    }).compile();

    bitcoinLoaderModule = module.get<BitcoinLoaderModule>(BitcoinLoaderModule);
  });

  it('should be defined', () => {
    expect(bitcoinLoaderModule).toBeDefined();
  });
});
