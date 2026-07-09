import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Channel, ChannelModel, ConsumeMessage, connect } from 'amqplib';
import { LoggingEmailSender } from '../email/logging-email.sender';
import { CommunicationConfigService } from '../config/communication.config';

const EMAIL_VERIFICATION_REQUESTED = 'email.verification_requested';
const PASSWORD_RESET_REQUESTED = 'password.reset_requested';

interface EventEnvelope<TPayload = unknown> {
  eventName?: string;
  payload?: TPayload;
  occurredAt?: string;
}

interface EmailVerificationRequestedEvent {
  userId: string;
  email: string;
  token: string;
  expiresAt: string;
}

interface PasswordResetRequestedEvent {
  userId: string;
  email: string;
  token: string;
  expiresAt: string;
}

@Injectable()
export class RabbitMqConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqConsumerService.name);
  private connection?: ChannelModel;
  private channel?: Channel;

  constructor(
    private readonly config: CommunicationConfigService,
    private readonly emailSender: LoggingEmailSender,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      this.connection = await connect(this.config.rabbitMqUrl);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(this.config.rabbitMqExchange, 'topic', { durable: true });
      await this.channel.assertQueue(this.config.rabbitMqQueue, { durable: true });
      await this.channel.bindQueue(this.config.rabbitMqQueue, this.config.rabbitMqExchange, '#');
      await this.channel.consume(this.config.rabbitMqQueue, (message) => void this.handleMessage(message), { noAck: false });
      this.logger.log(`Consuming ${this.config.rabbitMqQueue} from ${this.config.rabbitMqExchange}`);
    } catch (error) {
      this.logger.warn(`RabbitMQ consumer disabled: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  private async handleMessage(message: ConsumeMessage | null): Promise<void> {
    if (!message || !this.channel) return;

    try {
      const envelope = JSON.parse(message.content.toString('utf8')) as EventEnvelope;
      await this.dispatch(envelope.eventName ?? message.fields.routingKey, envelope.payload);
      this.channel.ack(message);
    } catch (error) {
      this.logger.error(`Failed to handle message ${message.fields.routingKey}: ${error instanceof Error ? error.message : String(error)}`);
      this.channel.nack(message, false, false);
    }
  }

  private async dispatch(eventName: string, payload: unknown): Promise<void> {
    switch (eventName) {
      case EMAIL_VERIFICATION_REQUESTED:
        await this.handleEmailVerificationRequested(payload as EmailVerificationRequestedEvent);
        break;
      case PASSWORD_RESET_REQUESTED:
        await this.handlePasswordResetRequested(payload as PasswordResetRequestedEvent);
        break;
      default:
        break;
    }
  }

  private async handleEmailVerificationRequested(payload: EmailVerificationRequestedEvent): Promise<void> {
    const verificationUrl = `${this.config.frontendBaseUrl}/verify-email?token=${encodeURIComponent(payload.token)}`;
    await this.emailSender.sendVerificationEmail({
      userId: payload.userId,
      email: payload.email,
      verificationUrl,
      expiresAt: payload.expiresAt,
    });
  }

  private async handlePasswordResetRequested(payload: PasswordResetRequestedEvent): Promise<void> {
    const resetUrl = `${this.config.frontendBaseUrl}/reset-password?token=${encodeURIComponent(payload.token)}`;
    await this.emailSender.sendPasswordResetEmail({
      userId: payload.userId,
      email: payload.email,
      resetUrl,
      expiresAt: payload.expiresAt,
    });
  }
}
