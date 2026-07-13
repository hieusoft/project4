const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

/**
 * Serve OpenAPI for docs hub (Kong: /api/marketplace/openapi.json)
 * and local Swagger UI at /api-docs.
 */
const setupSwagger = (app) => {
  app.get('/openapi.json', (_req, res) => {
    res.json(swaggerDocument);
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
};

module.exports = setupSwagger;
