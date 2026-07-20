class StatsUseCases {
  constructor({ statsRepository }) {
    this.statsRepository = statsRepository;
  }

  async getDailyStats(filters = {}) {
    return await this.statsRepository.find(filters);
  }

  async getSummary(filters = {}) {
    if (typeof this.statsRepository.getSummary !== 'function') {
      return {};
    }
    return await this.statsRepository.getSummary(filters);
  }

  async recordEvent(eventType, eventData) {
    if (!this.statsRepository || typeof this.statsRepository.upsert !== 'function') {
      console.warn('StatsRepository.upsert is not fully implemented yet.');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const groupId = eventData.groupId || null;

    try {
      switch (eventType) {
        case 'user.verified':
          await this.statsRepository.upsert(today, null, 'new_users', 1);
          break;
        case 'group.member_approved':
          await this.statsRepository.upsert(today, groupId, 'new_members', 1);
          await this.statsRepository.upsert(today, null, 'new_members', 1);
          break;
        case 'donation.completed':
          await this.statsRepository.upsert(today, groupId, 'donations_count', 1);
          await this.statsRepository.upsert(today, null, 'donations_count', 1);
          await this.statsRepository.upsert(today, groupId, 'items_received', eventData.itemCount || 1);
          await this.statsRepository.upsert(today, null, 'items_received', eventData.itemCount || 1);
          break;
        case 'listing.created':
          await this.statsRepository.upsert(today, groupId, 'items_listed', 1);
          await this.statsRepository.upsert(today, null, 'items_listed', 1);
          break;
        case 'request.completed':
          await this.statsRepository.upsert(today, groupId, 'requests_count', 1);
          await this.statsRepository.upsert(today, null, 'requests_count', 1);
          await this.statsRepository.upsert(today, groupId, 'items_delivered', eventData.quantity || 1);
          await this.statsRepository.upsert(today, null, 'items_delivered', eventData.quantity || 1);
          await this.statsRepository.upsert(today, groupId, 'people_helped', 1);
          await this.statsRepository.upsert(today, null, 'people_helped', 1);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error(`Error recording event ${eventType} in StatsUseCases:`, err);
    }
  }
}

module.exports = StatsUseCases;
