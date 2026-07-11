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


// Api Interfaces
const ListingController = require('./src/Api/Controllers/ListingController');
const RequestController = require('./src/Api/Controllers/RequestController');
const StatsController = require('./src/Api/Controllers/StatsController');
const createRouter = require('./src/Api/Routes/index');
const setupSwagger = require('./src/Api/Swagger/index');

async function bootstrap() {
  const app = express();
  const PORT = process.env.PORT || 3004;

  app.use(cors());
  app.use(express.json());

  setupSwagger(app);
  await rabbitMQPublisher.connect();

  // Instantiate Repositories
  const listingRepository = new ListingRepository(db);
  const listingImageRepository = new ListingImageRepository(db);
  const requestRepository = new RequestRepository(db);
  const deliveryConfirmationRepository = new DeliveryConfirmationRepository(db);
  const statsRepository = new StatsRepository(db);

  // Instantiate Use Cases
  const listingUseCases = new ListingUseCases({ listingRepository, messagePublisher: rabbitMQPublisher });

  const requestUseCases = new RequestUseCases({ requestRepository, listingRepository, messagePublisher: rabbitMQPublisher });

  const statsUseCases = new StatsUseCases({ statsRepository });


  // Instantiate Controllers
  const listingController = new ListingController({ listingUseCases });
  const requestController = new RequestController({ requestUseCases });
  const statsController = new StatsController({ statsUseCases });

  // Init Router
  const apiRouter = createRouter({ listingController, requestController, statsController });
  app.use('/', apiRouter);

  // 404 Handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found', path: req.path });
  });

  app.listen(PORT, () => {
    console.log(`Marketplace Service running on port ${PORT}`);
  });
}

bootstrap();
