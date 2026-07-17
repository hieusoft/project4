import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { AiController } from './presentation/http/ai.controller';
import { ModerationController } from './presentation/messaging/moderation.controller';
import { DetectItemUseCase } from './application/use-cases/detect-item.usecase';
import { GenerateDescriptionUseCase } from './application/use-cases/generate-description.usecase';
import { SuggestGroupsUseCase } from './application/use-cases/suggest-groups.usecase';
import { ModerateContentUseCase } from './application/use-cases/moderate-content.usecase';
import { GenerateImageUseCase } from './application/use-cases/generate-image.usecase';

@Module({
  imports: [InfrastructureModule],
  controllers: [AppController, AiController, ModerationController],
  providers: [
    AppService,
    DetectItemUseCase,
    GenerateDescriptionUseCase,
    SuggestGroupsUseCase,
    ModerateContentUseCase,
    GenerateImageUseCase,
  ],
})
export class AppModule {}
