const { Pool } = require('pg');

class PostgresDB {
  constructor() {
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT || 5432,
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      database: 'marketplace_db',
    });
  }

  async query(text, params) {
    return await this.pool.query(text, params);
  }

  async getClient() {
    return await this.pool.connect();
  }
}

module.exports = new PostgresDB();
