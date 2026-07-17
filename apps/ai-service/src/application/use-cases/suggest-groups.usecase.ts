import { Injectable, Inject } from '@nestjs/common';
import { IAiProvider, AI_PROVIDER } from '../../domain/ports/ai-provider.interface';

@Injectable()
export class SuggestGroupsUseCase {
  constructor(
    @Inject(AI_PROVIDER)
    private readonly aiProvider: IAiProvider,
  ) {}

  async execute(description: string, province: string, activeGroups: any[]): Promise<any[]> {
    if (!description || !province || !activeGroups) {
      throw new Error('description, province, and activeGroups are required');
    }
    return this.aiProvider.suggestGroups(description, province, activeGroups);
  }
}
