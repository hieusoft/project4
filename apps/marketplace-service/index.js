require('dotenv').config({ path: '../../.env' });
const express = require('express');
const cors = require('cors');

// Infrastructure
const db = require('./src/Infrastructure/Database/postgres');
const rabbitMQPublisher = require('./src/Infrastructure/Services/RabbitMQPublisher');
const ListingRepository = require('./src/Infrastructure/Database/Repositories/ListingRepository');
const ListingImageRepository = require('./src/Infrastructure/Database/Repositories/ListingImageRepository');
const RequestRepository = require('./src/Infrastructure/Database/Repositories/RequestRepository');
const DeliveryConfirmationRepository = require('./src/Infrastructure/Database/Repositories/DeliveryConfirmationRepository');
const StatsRepository = require('./src/Infrastructure/Database/Repositories/StatsRepository');

// Application Use Cases
const ListingUseCases = require('./src/Application/UseCases/ListingUseCases');
const RequestUseCases = require('./src/Application/UseCases/RequestUseCases');
const StatsUseCases = require('./src/Application/UseCases/StatsUseCases');
const ListingImageUseCases = require('./src/Application/UseCases/ListingImageUseCases');

// Api Interfaces
const ListingController = require('./src/Api/Controllers/ListingController');
const RequestController = require('./src/Api/Controllers/RequestController');
const StatsController = require('./src/Api/Controllers/StatsController');
const ListingImageController = require('./src/Api/Controllers/ListingImageController');
const createRouter = require('./src/Api/Routes/index');
const setupSwagger = require('./src/Api/Swagger/index');

async function bootstrap() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3004;

  app.use(cors());
  app.use(express.json());

  // OpenAPI + health first so Kong/docs hub work even if MQ/DB are slow
  setupSwagger(app);
  app.get('/health', (_req, res) => {
    res.json({ service: 'marketplace-service', status: 'ok' });
  });

  // Instantiate Repositories
  const listingRepository = new ListingRepository(db);
  const listingImageRepository = new ListingImageRepository(db);
  const requestRepository = new RequestRepository(db);
  const deliveryConfirmationRepository = new DeliveryConfirmationRepository(db);
  const statsRepository = new StatsRepository(db);

  // Instantiate Use Cases
  const listingUseCases = new ListingUseCases({
    listingRepository,
    messagePublisher: rabbitMQPublisher,
  });
  const requestUseCases = new RequestUseCases({
    requestRepository,
    listingRepository,
    messagePublisher: rabbitMQPublisher,
    deliveryConfirmationRepository,
  });
  const statsUseCases = new StatsUseCases({ statsRepository });
  const listingImageUseCases = new ListingImageUseCases({
    listingImageRepository,
  });

  // Instantiate Controllers
  const listingController = new ListingController({ listingUseCases });
  const requestController = new RequestController({ requestUseCases });
  const statsController = new StatsController({ statsUseCases });
  const listingImageController = new ListingImageController({ listingImageUseCases });

  const apiRouter = createRouter({
    listingController,
    requestController,
    statsController,
    listingImageController,
  });
  app.use('/', apiRouter);

  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found', path: req.path });
  });

  // Listen BEFORE RabbitMQ — amqp.connect can hang and would block OpenAPI otherwise
  await new Promise((resolve, reject) => {
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Marketplace Service running on 0.0.0.0:${PORT}`);
      resolve(server);
    });
    server.on('error', reject);
  });

  // Background MQ connect (do not block HTTP)
  rabbitMQPublisher.connect().catch((err) => {
    console.error('RabbitMQ background connect failed:', err.message || err);
  });
}

bootstrap().catch((err) => {
  console.error('Marketplace bootstrap failed:', err);
  process.exit(1);
});
