import { Module } from '@nestjs/common';
import { GeminiProvider } from './providers/gemini.provider';
import { AI_PROVIDER } from '../domain/ports/ai-provider.interface';

@Module({
  providers: [
    {
      provide: AI_PROVIDER,
      useClass: GeminiProvider,
    },
  ],
  exports: [AI_PROVIDER],
})
export class InfrastructureModule {}
