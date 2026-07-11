class StatsUseCases {
  constructor({ statsRepository }) {
    this.statsRepository = statsRepository;
  }

  async getDailyStats(filters = {}) {
    return await this.statsRepository.find(filters);
  }
}

module.exports = StatsUseCases;
