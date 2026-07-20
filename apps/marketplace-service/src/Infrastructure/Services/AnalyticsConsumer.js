const amqp = require('amqplib');

const EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'charity.events';
const QUEUE = 'marketplace.analytics.queue';

/**
 * Consume domain events and upsert daily_stats.
 */
class AnalyticsConsumer {
  constructor({ statsRepository, url }) {
    this.statsRepository = statsRepository;
    this.url = url || process.env.RABBITMQ_URL || 'amqp://charity:charity@localhost:5672';
    this.connection = null;
    this.channel = null;
  }

  async connect() {
    this.connection = await amqp.connect(this.url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    await this.channel.assertQueue(QUEUE, { durable: true });

    const keys = [
      'listing.created',
      'request.created',
      'request.completed',
      'donation.completed',
      'user.verified',
      'group.member_approved',
    ];
    for (const key of keys) {
      await this.channel.bindQueue(QUEUE, EXCHANGE, key);
    }

    await this.channel.consume(QUEUE, (msg) => this._onMessage(msg), { noAck: false });
    console.log('AnalyticsConsumer listening on', QUEUE);
  }

  async _onMessage(msg) {
    if (!msg) return;
    try {
      const routingKey = msg.fields.routingKey;
      const payload = JSON.parse(msg.content.toString());
      await this._handle(routingKey, payload);
      this.channel.ack(msg);
    } catch (err) {
      console.error('AnalyticsConsumer error:', err.message || err);
      this.channel.nack(msg, false, false);
    }
  }

  _today() {
    return new Date().toISOString().slice(0, 10);
  }

  async _inc(field, groupId) {
    const day = this._today();
    // group-level
    if (groupId) {
      await this.statsRepository.upsert(day, groupId, field);
    }
    // platform-wide
    await this.statsRepository.upsert(day, null, field);
  }

  async _handle(routingKey, p) {
    const groupId = p.groupId || p.group_id || null;
    switch (routingKey) {
      case 'listing.created':
        await this._inc('items_listed', groupId);
        break;
      case 'request.created':
        await this._inc('requests_count', groupId);
        break;
      case 'request.completed':
        await this._inc('items_delivered', groupId);
        await this._inc('people_helped', groupId);
        break;
      case 'donation.completed':
        await this._inc('donations_count', groupId);
        await this._inc('items_received', groupId);
        break;
      case 'user.verified':
        await this._inc('new_users', null);
        break;
      case 'group.member_approved':
        await this._inc('new_members', groupId);
        break;
      default:
        break;
    }
  }

  async close() {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
  }
}

module.exports = AnalyticsConsumer;
