const DailyStat = require('../../../Domain/Entities/DailyStat');
const IStatsRepository = require('../../../Application/Interfaces/IStatsRepository');

class StatsRepository extends IStatsRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  async find(filters = {}) {
    let queryText = 'SELECT * FROM daily_stats WHERE 1=1';
    const params = [];

    if (filters.stat_date) {
      params.push(filters.stat_date);
      queryText += ` AND stat_date = $${params.length}`;
    }

    if (filters.group_id) {
      params.push(filters.group_id);
      queryText += ` AND group_id = $${params.length}`;
    } else {
      queryText += ` AND group_id IS NULL`; // Default to platform-wide stats
    }

    queryText += ' ORDER BY stat_date DESC LIMIT 30';

    const { rows } = await this.db.query(queryText, params);
    return rows.map(row => new DailyStat(row));
  }

  async upsert(statDate, groupId, fieldToIncrement) {
    const allowedFields = [
      'donations_count', 'items_received', 'items_listed', 'items_delivered',
      'requests_count', 'people_helped', 'new_users', 'new_members'
    ];
    if (!allowedFields.includes(fieldToIncrement)) return;

    const groupCondition = groupId ? '$2' : 'NULL';
    const params = groupId ? [statDate, groupId] : [statDate];

    const queryText = `
      INSERT INTO daily_stats (stat_date, group_id, ${fieldToIncrement})
      VALUES ($1, ${groupCondition}, 1)
      ON CONFLICT (stat_date, group_id) 
      DO UPDATE SET ${fieldToIncrement} = daily_stats.${fieldToIncrement} + 1
      RETURNING *
    `;

    const { rows } = await this.db.query(queryText, params);
    return new DailyStat(rows[0]);
  }
}

module.exports = StatsRepository;
