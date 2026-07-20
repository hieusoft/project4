class StatsUseCases {
  constructor({ statsRepository }) {
    this.statsRepository = statsRepository;
  }

  async getDailyStats(filters = {}) {
    return await this.statsRepository.find(filters);
  }

  async getOverview(groupId = null) {
    return await this.statsRepository.overview(groupId);
  }
}

module.exports = StatsUseCases;
