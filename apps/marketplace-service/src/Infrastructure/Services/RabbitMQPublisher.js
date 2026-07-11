const amqp = require('amqplib');
const IEventPublisher = require('../../Application/Interfaces/IEventPublisher');

const EXCHANGE = 'charity.events';

// Declare sẵn queue + bind để message không bị drop khi consumer chưa chạy.
const QUEUE_BINDINGS = [
  // Analytics
  { queue: 'marketplace.analytics.queue', routingKey: 'listing.created' },
  { queue: 'marketplace.analytics.queue', routingKey: 'request.completed' },
  
  // Communication
  { queue: 'communication.events', routingKey: 'listing.created' },
  { queue: 'communication.events', routingKey: 'request.created' },
  { queue: 'communication.events', routingKey: 'request.approved' },
  { queue: 'communication.events', routingKey: 'request.rejected' },
  { queue: 'communication.events', routingKey: 'request.scheduled' },
  { queue: 'communication.events', routingKey: 'request.completed' },
];

class RabbitMQPublisher extends IEventPublisher {
  constructor(url) {
    super();
    this.url = url;
    this.channel = null;
    this.connection = null;
  }

  async connect() {
    try {
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(EXCHANGE, 'topic', { durable: true });

      for (const { queue, routingKey } of QUEUE_BINDINGS) {
        await this.channel.assertQueue(queue, { durable: true });
        await this.channel.bindQueue(queue, EXCHANGE, routingKey);
      }
      
      console.log('Connected to RabbitMQ and bindings asserted');
    } catch (error) {
      console.error('RabbitMQ connection error:', error);
    }
  }

  async close() {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    this.channel = null;
    this.connection = null;
  }

  publish(routingKey, payload) {
    if (!this.channel) {
      console.warn(`RabbitMQ not connected — dropping event ${routingKey}`);
      return;
    }
    this.channel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), {
      contentType: 'application/json',
      timestamp: Date.now(),
      persistent: true
    });
    console.log(`Event published: ${routingKey}`);
  }

  publishListingCreated(payload) {
    this.publish('listing.created', payload);
  }

  publishRequestCreated(payload) {
    this.publish('request.created', payload);
  }

  publishRequestApproved(payload) {
    this.publish('request.approved', payload);
  }

  publishRequestRejected(payload) {
    this.publish('request.rejected', payload);
  }

  publishRequestScheduled(payload) {
    this.publish('request.scheduled', payload);
  }

  publishRequestCompleted(payload) {
    this.publish('request.completed', payload);
  }
}

module.exports = new RabbitMQPublisher(process.env.RABBITMQ_URL || 'amqp://charity:charity@localhost:5672');
