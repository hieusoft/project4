import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { ModerateContentUseCase } from '../../application/use-cases/moderate-content.usecase';

@Controller()
export class ModerationController {
  private readonly logger = new Logger(ModerationController.name);

  constructor(private readonly moderateContentUseCase: ModerateContentUseCase) {}

  @EventPattern('post.created')
  async handlePostCreated(@Payload() data: any, @Ctx() context: RmqContext) {
    this.logger.log(`Received post.created event for post ID: ${data.id}`);
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      if (data.content) {
        const result = await this.moderateContentUseCase.execute(data.content, 'post');
        if (result.isBlocked) {
          this.logger.warn(`Post ${data.id} is blocked by AI. Reason: ${result.reason}`);
        } else {
          this.logger.log(`Post ${data.id} is safe.`);
        }
      }
      channel.ack(originalMsg);
    } catch (error: any) {
      this.logger.error(`Error processing post.created`, error.stack);
      channel.nack(originalMsg, false, true);
    }
  }

  @EventPattern('listing.created')
  async handleListingCreated(@Payload() data: any, @Ctx() context: RmqContext) {
    this.logger.log(`Received listing.created event for listing ID: ${data.id}`);
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      if (data.description || data.title) {
        const content = `${data.title} - ${data.description}`;
        const result = await this.moderateContentUseCase.execute(content, 'listing');
        if (result.isBlocked) {
          this.logger.warn(`Listing ${data.id} is blocked by AI. Reason: ${result.reason}`);
        }
      }
      channel.ack(originalMsg);
    } catch (error: any) {
      this.logger.error(`Error processing listing.created`, error.stack);
      channel.nack(originalMsg, false, true);
    }
  }

  @EventPattern('message.sent')
  async handleMessageSent(@Payload() data: any, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      if (data.content) {
        const result = await this.moderateContentUseCase.execute(data.content, 'message');
        if (result.isBlocked) {
          this.logger.warn(`Message ${data.id} is blocked by AI. Reason: ${result.reason}`);
        }
      }
      channel.ack(originalMsg);
    } catch (error: any) {
      channel.nack(originalMsg, false, true);
    }
  }
}
