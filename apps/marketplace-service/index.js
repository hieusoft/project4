require('dotenv').config({ path: '../../.env' });
const express = require('express');
const cors = require('cors');

const db = require('./src/Infrastructure/Database/postgres');
const rabbitMQPublisher = require('./src/Infrastructure/Services/RabbitMQPublisher');
const CommunityClient = require('./src/Infrastructure/Services/CommunityClient');
const DonationClient = require('./src/Infrastructure/Services/DonationClient');
const AnalyticsConsumer = require('./src/Infrastructure/Services/AnalyticsConsumer');

const ListingRepository = require('./src/Infrastructure/Database/Repositories/ListingRepository');
const ListingImageRepository = require('./src/Infrastructure/Database/Repositories/ListingImageRepository');
const RequestRepository = require('./src/Infrastructure/Database/Repositories/RequestRepository');
const DeliveryConfirmationRepository = require('./src/Infrastructure/Database/Repositories/DeliveryConfirmationRepository');
const StatsRepository = require('./src/Infrastructure/Database/Repositories/StatsRepository');

const ListingUseCases = require('./src/Application/UseCases/ListingUseCases');
const RequestUseCases = require('./src/Application/UseCases/RequestUseCases');
const StatsUseCases = require('./src/Application/UseCases/StatsUseCases');
const ListingImageUseCases = require('./src/Application/UseCases/ListingImageUseCases');

const ListingController = require('./src/Api/Controllers/ListingController');
const RequestController = require('./src/Api/Controllers/RequestController');
const StatsController = require('./src/Api/Controllers/StatsController');
const ListingImageController = require('./src/Api/Controllers/ListingImageController');
const createRouter = require('./src/Api/Routes/index');
const setupSwagger = require('./src/Api/Swagger/index');

async function bootstrap() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3004;

  app.use(cors({ origin: '*' }));
  app.use(express.json());

  setupSwagger(app);
  app.get('/health', (_req, res) => {
    res.json({ service: 'marketplace-service', status: 'ok' });
  });

  const communityClient = new CommunityClient();
  const donationClient = new DonationClient();

  const listingRepository = new ListingRepository(db);
  const listingImageRepository = new ListingImageRepository(db);
  const requestRepository = new RequestRepository(db);
  const deliveryConfirmationRepository = new DeliveryConfirmationRepository(db);
  const statsRepository = new StatsRepository(db);

  const listingUseCases = new ListingUseCases({
    listingRepository,
    messagePublisher: rabbitMQPublisher,
    donationClient,
    communityClient,
  });
  const requestUseCases = new RequestUseCases({
    requestRepository,
    listingRepository,
    messagePublisher: rabbitMQPublisher,
    deliveryConfirmationRepository,
    donationClient,
    communityClient,
  });
  const statsUseCases = new StatsUseCases({ statsRepository });
  const listingImageUseCases = new ListingImageUseCases({
    listingImageRepository,
  });

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

  await new Promise((resolve, reject) => {
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Marketplace Service running on 0.0.0.0:${PORT}`);
      resolve(server);
    });
    server.on('error', reject);
  });

  rabbitMQPublisher.connect().catch((err) => {
    console.error('RabbitMQ publisher connect failed:', err.message || err);
  });

  const analytics = new AnalyticsConsumer({ statsRepository });
  analytics.connect().catch((err) => {
    console.error('AnalyticsConsumer connect failed:', err.message || err);
  });
}

bootstrap().catch((err) => {
  console.error('Marketplace bootstrap failed:', err);
  process.exit(1);
});
