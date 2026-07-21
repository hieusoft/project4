import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { DetectItemUseCase } from '../../application/use-cases/detect-item.usecase';
import { GenerateDescriptionUseCase } from '../../application/use-cases/generate-description.usecase';
import { SuggestGroupsUseCase } from '../../application/use-cases/suggest-groups.usecase';
import { GenerateImageUseCase } from '../../application/use-cases/generate-image.usecase';

@ApiTags('ai')
@Controller()
export class AiController {
  constructor(
    private readonly detectItemUseCase: DetectItemUseCase,
    private readonly generateDescriptionUseCase: GenerateDescriptionUseCase,
    private readonly suggestGroupsUseCase: SuggestGroupsUseCase,
    private readonly generateImageUseCase: GenerateImageUseCase,
  ) {}

  @Post('detect-item')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Phân tích hình ảnh để nhận diện món đồ quyên góp' })
  @ApiBody({ schema: { type: 'object', properties: { imageUrl: { type: 'string' } } } })
  async detectItem(@Body() body: { imageUrl: string }) {
    if (!body.imageUrl) {
      return { error: 'imageUrl is required' };
    }
    return this.detectItemUseCase.execute(body.imageUrl);
  }

  @Post('generate-description')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tự động sinh mô tả cho tin đăng gian hàng' })
  @ApiBody({ schema: { type: 'object', properties: { name: { type: 'string' }, condition: { type: 'string' } } } })
  async generateDescription(@Body() body: { name: string; condition: string }) {
    if (!body.name || !body.condition) {
      return { error: 'name and condition are required' };
    }
    const description = await this.generateDescriptionUseCase.execute(body.name, body.condition);
    return { description };
  }

  @Post('suggest-groups')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gợi ý các nhóm từ thiện phù hợp' })
  @ApiBody({ schema: { type: 'object', properties: { description: { type: 'string' }, province: { type: 'string' }, activeGroups: { type: 'array', items: { type: 'object' } } } } })
  async suggestGroups(@Body() body: { description: string; province: string; activeGroups: any[] }) {
    if (!body.description || !body.province || !body.activeGroups) {
      return { error: 'description, province, and activeGroups are required' };
    }
    const suggestions = await this.suggestGroupsUseCase.execute(body.description, body.province, body.activeGroups);
    return { suggestions };
  }

  @Post('generate-image')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tự động sinh hình ảnh minh hoạ' })
  @ApiBody({ schema: { type: 'object', properties: { prompt: { type: 'string' } } } })
  async generateImage(@Body() body: { prompt: string }) {
    if (!body.prompt) {
      return { error: 'prompt is required' };
    }
    const imageUrl = await this.generateImageUseCase.execute(body.prompt);
    return { imageUrl };
  }
}

