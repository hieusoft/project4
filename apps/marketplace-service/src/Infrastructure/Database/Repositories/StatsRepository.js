const DailyStat = require('../../../Domain/Entities/DailyStat');
const IStatsRepository = require('../../../Application/Interfaces/IStatsRepository');

const ALLOWED = [
  'donations_count',
  'items_received',
  'items_listed',
  'items_delivered',
  'requests_count',
  'people_helped',
  'new_users',
  'new_members',
];

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
    } else if (filters.platform === 'true' || filters.platform === true || !filters.group_id) {
      // default: platform-wide when no group_id
      if (!filters.all) {
        queryText += ' AND group_id IS NULL';
      }
    }

    const limit = parseInt(filters.limit, 10) || 30;
    params.push(limit);
    queryText += ` ORDER BY stat_date DESC LIMIT $${params.length}`;

    const { rows } = await this.db.query(queryText, params);
    return rows.map((row) => new DailyStat(row));
  }

  async overview(groupId = null) {
    const where = groupId ? 'group_id = $1' : 'group_id IS NULL';
    const params = groupId ? [groupId] : [];
    const { rows } = await this.db.query(
      `
      SELECT
        COALESCE(SUM(donations_count), 0)::int AS donations_count,
        COALESCE(SUM(items_received), 0)::int AS items_received,
        COALESCE(SUM(items_listed), 0)::int AS items_listed,
        COALESCE(SUM(items_delivered), 0)::int AS items_delivered,
        COALESCE(SUM(requests_count), 0)::int AS requests_count,
        COALESCE(SUM(people_helped), 0)::int AS people_helped,
        COALESCE(SUM(new_users), 0)::int AS new_users,
        COALESCE(SUM(new_members), 0)::int AS new_members
      FROM daily_stats
      WHERE ${where}
      `,
      params
    );
    return rows[0] || {};
  }

  /**
   * Increment a counter for (date, group). groupId null = platform-wide.
   * Handles NULL group_id (PG UNIQUE does not treat NULL as equal).
   */
  async upsert(statDate, groupId, fieldToIncrement) {
    if (!ALLOWED.includes(fieldToIncrement)) return null;

    if (groupId) {
      const { rows } = await this.db.query(
        `
        INSERT INTO daily_stats (stat_date, group_id, ${fieldToIncrement})
        VALUES ($1, $2, 1)
        ON CONFLICT (stat_date, group_id)
        DO UPDATE SET ${fieldToIncrement} = daily_stats.${fieldToIncrement} + 1
        RETURNING *
        `,
        [statDate, groupId]
      );
      return new DailyStat(rows[0]);
    }

    // platform-wide: group_id IS NULL
    const existing = await this.db.query(
      `SELECT id FROM daily_stats WHERE stat_date = $1 AND group_id IS NULL LIMIT 1`,
      [statDate]
    );
    if (existing.rows.length > 0) {
      const { rows } = await this.db.query(
        `
        UPDATE daily_stats
        SET ${fieldToIncrement} = ${fieldToIncrement} + 1
        WHERE id = $1
        RETURNING *
        `,
        [existing.rows[0].id]
      );
      return new DailyStat(rows[0]);
    }
    const { rows } = await this.db.query(
      `
      INSERT INTO daily_stats (stat_date, group_id, ${fieldToIncrement})
      VALUES ($1, NULL, 1)
      RETURNING *
      `,
      [statDate]
    );
    return new DailyStat(rows[0]);
  }
}

module.exports = StatsRepository;
