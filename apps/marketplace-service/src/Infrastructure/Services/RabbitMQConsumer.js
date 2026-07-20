const amqp = require('amqplib');

class RabbitMQConsumer {
  constructor(statsUseCases, listingUseCases) {
    this.statsUseCases = statsUseCases;
    this.listingUseCases = listingUseCases;
    this.url = process.env.RABBITMQ_URL || 'amqp://charity:charity@localhost:5672';
    this.connection = null;
    this.channel = null;
    this.queueName = 'marketplace.analytics.queue';
  }

  async connect() {
    try {
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();

      // Assert exchange and queue
      const exchange = 'charity.events';
      await this.channel.assertExchange(exchange, 'topic', { durable: true });
      await this.channel.assertQueue(this.queueName, { durable: true });

      // Bind queue to topics we care about for stats
      const topics = [
        'user.verified',
        'donation.completed',
        'listing.created',
        'request.completed',
        'group.member_approved',
        'ai.moderation_result'
      ];

      for (const topic of topics) {
        await this.channel.bindQueue(this.queueName, exchange, topic);
      }

      console.log(`RabbitMQ Consumer waiting for messages in ${this.queueName}`);

      this.channel.consume(this.queueName, async (msg) => {
        if (msg !== null) {
          const routingKey = msg.fields.routingKey;
          const content = JSON.parse(msg.content.toString());
          
          try {
            console.log(`Received event: ${routingKey}`, content);
            
            // Handle AI moderation verdict
            if (routingKey === 'ai.moderation_result' && content.verdict === 'blocked' && content.refType === 'listing') {
               console.log(`Listing ${content.refId} was blocked by AI. Updating status to blocked.`);
               if (this.listingUseCases) {
                 await this.listingUseCases.blockListing(content.refId);
               }
            } else {
               // Record stats
               await this.statsUseCases.recordEvent(routingKey, content);
            }
            
            this.channel.ack(msg);
          } catch (err) {
            console.error(`Error processing message ${routingKey}:`, err);
            // Nack the message so it can be retried or dead-lettered
            this.channel.nack(msg, false, false);
          }
        }
      });
    } catch (error) {
      console.error('RabbitMQ Consumer failed to connect:', error.message);
      // Reconnect logic could be added here
      setTimeout(() => this.connect(), 5000);
    }
  }
}

module.exports = RabbitMQConsumer;
