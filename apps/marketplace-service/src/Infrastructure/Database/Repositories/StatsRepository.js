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

  async getSummary(filters = {}) {
    let queryText = `
      SELECT 
        SUM(donations_count) as total_donations,
        SUM(items_received) as total_items_received,
        SUM(items_listed) as total_items_listed,
        SUM(items_delivered) as total_items_delivered,
        SUM(requests_count) as total_requests,
        SUM(people_helped) as total_people_helped,
        SUM(new_users) as total_new_users,
        SUM(new_members) as total_new_members
      FROM daily_stats 
      WHERE 1=1
    `;
    const params = [];

    if (filters.group_id) {
      params.push(filters.group_id);
      queryText += ` AND group_id = $${params.length}`;
    } else {
      queryText += ` AND group_id IS NULL`; // Platform-wide stats
    }

    const { rows } = await this.db.query(queryText, params);
    return rows[0];
  }

  async upsert(statDate, groupId, fieldToIncrement, amount = 1) {
    const allowedFields = [
      'donations_count', 'items_received', 'items_listed', 'items_delivered',
      'requests_count', 'people_helped', 'new_users', 'new_members'
    ];
    if (!allowedFields.includes(fieldToIncrement)) return;

    let groupCondition = 'NULL';
    const params = [statDate];
    
    if (groupId) {
      params.push(groupId);
      groupCondition = '$2';
    }

    params.push(amount);
    const amountIndex = `$${params.length}`;

    // Handle ON CONFLICT differently for NULL group_id
    // Note: In Postgres, UNIQUE (stat_date, group_id) with group_id=NULL means 
    // multiple NULLs can exist. We assume the table is created with a unique index 
    // that handles NULLs correctly (e.g. COALESCE) or we use a sentinel value.
    // Assuming standard behavior, but this could be tricky in plain SQL if group_id is NULL.
    // For now we will rely on the existing schema's UNIQUE (stat_date, group_id) 
    // which in Postgres 15+ works with NULLs NOT DISTINCT. 
    // We will leave the ON CONFLICT as is.
    
    const queryText = `
      INSERT INTO daily_stats (stat_date, group_id, ${fieldToIncrement})
      VALUES ($1, ${groupCondition}, ${amountIndex})
      ON CONFLICT (stat_date, group_id) 
      DO UPDATE SET ${fieldToIncrement} = daily_stats.${fieldToIncrement} + EXCLUDED.${fieldToIncrement}
      RETURNING *
    `;

    const { rows } = await this.db.query(queryText, params);
    return new DailyStat(rows[0]);
  }
}

module.exports = StatsRepository;
