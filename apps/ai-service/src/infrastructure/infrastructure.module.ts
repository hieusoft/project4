import { Module } from '@nestjs/common';
import { OpenAiProvider } from './providers/openai.provider';
import { AI_PROVIDER } from '../domain/ports/ai-provider.interface';

@Module({
  providers: [
    {
      provide: AI_PROVIDER,
      useClass: OpenAiProvider,
    },
  ],
  exports: [AI_PROVIDER],
})
export class InfrastructureModule {}
