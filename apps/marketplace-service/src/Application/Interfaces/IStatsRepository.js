class IStatsRepository {
  async find(filters) { throw new Error("Method not implemented."); }
  async upsert(statDate, groupId, fieldToIncrement) { throw new Error("Method not implemented."); }
}
module.exports = IStatsRepository;
