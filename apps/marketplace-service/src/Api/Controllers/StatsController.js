const ApiResponse = require('../Responses/ApiResponse');

class StatsController {
  constructor({ statsUseCases }) {
    this.statsUseCases = statsUseCases;
  }

  async getStats(req, res) {
    try {
      const stats = await this.statsUseCases.getDailyStats(req.query);
      return ApiResponse.success(res, stats);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err, 500);
    }
  }

  async getSummary(req, res) {
    try {
      const summary = await this.statsUseCases.getSummary(req.query);
      return ApiResponse.success(res, summary);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err, 500);
    }
  }
}

module.exports = StatsController;