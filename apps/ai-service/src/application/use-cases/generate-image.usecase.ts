import { Injectable, Inject } from '@nestjs/common';
import { IAiProvider, AI_PROVIDER } from '../../domain/ports/ai-provider.interface';

@Injectable()
export class GenerateImageUseCase {
  constructor(
    @Inject(AI_PROVIDER)
    private readonly aiProvider: IAiProvider,
  ) {}

  async execute(prompt: string): Promise<string> {
    if (!prompt) {
      throw new Error('prompt is required');
    }
    return this.aiProvider.generateImage(prompt);
  }
}
