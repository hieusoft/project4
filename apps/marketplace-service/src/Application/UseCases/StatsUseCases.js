class StatsUseCases {
  constructor({ statsRepository }) {
    this.statsRepository = statsRepository;
  }

  async getDailyStats(date, groupId = null) {
    return await this.statsRepository.findByDateAndGroup(date, groupId);
  }
}

module.exports = StatsUseCases;
