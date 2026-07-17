import { Injectable, Inject } from '@nestjs/common';
import { IAiProvider, AI_PROVIDER } from '../../domain/ports/ai-provider.interface';
import { ItemInfo } from '../../domain/models/item-info.model';

@Injectable()
export class DetectItemUseCase {
  constructor(
    @Inject(AI_PROVIDER)
    private readonly aiProvider: IAiProvider,
  ) {}

  async execute(imageUrl: string): Promise<ItemInfo> {
    if (!imageUrl) {
      throw new Error('imageUrl is required');
    }
    return this.aiProvider.detectItem(imageUrl);
  }
}
