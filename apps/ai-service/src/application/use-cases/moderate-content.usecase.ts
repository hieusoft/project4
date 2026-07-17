import { Injectable, Inject } from '@nestjs/common';
import { IAiProvider, AI_PROVIDER } from '../../domain/ports/ai-provider.interface';
import { ModerationResult } from '../../domain/models/moderation-result.model';

@Injectable()
export class ModerateContentUseCase {
  constructor(
    @Inject(AI_PROVIDER)
    private readonly aiProvider: IAiProvider,
  ) {}

  async execute(content: string, type: 'post' | 'message' | 'listing'): Promise<ModerationResult> {
    if (!content) {
      return { isBlocked: false };
    }
    return this.aiProvider.moderateContent(content, type);
  }
}
