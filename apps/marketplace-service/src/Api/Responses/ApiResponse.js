class ApiResponse {
  static success(res, data, statusCode = 200, meta = null) {
    const response = { data };
    if (meta) {
      response.meta = meta;
    }
    return res.status(statusCode).json(response);
  }

  static error(res, error, statusCode = 400) {
    const status = error.statusCode || statusCode;
    return res.status(status).json({
      statusCode: status,
      error: error.message || 'Internal Server Error',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = ApiResponse;
