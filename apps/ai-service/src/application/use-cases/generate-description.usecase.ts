import { Injectable, Inject } from '@nestjs/common';
import { IAiProvider, AI_PROVIDER } from '../../domain/ports/ai-provider.interface';

@Injectable()
export class GenerateDescriptionUseCase {
  constructor(
    @Inject(AI_PROVIDER)
    private readonly aiProvider: IAiProvider,
  ) {}

  async execute(name: string, condition: string): Promise<string> {
    if (!name || !condition) {
      throw new Error('name and condition are required');
    }
    return this.aiProvider.generateDescription(name, condition);
  }
}
