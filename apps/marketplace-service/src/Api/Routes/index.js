const express = require('express');

function createRouter({ listingController, requestController, statsController }) {
  const router = express.Router();

  router.get('/catalog', (req, res) => listingController.getCatalog(req, res));
  router.get('/listings', (req, res) => listingController.getListings(req, res));
  router.get('/listings/:id', (req, res) => listingController.getListingById(req, res));
  router.post('/listings', (req, res) => listingController.createListing(req, res));

  router.get('/requests', (req, res) => requestController.getRequests(req, res));
  router.post('/requests', (req, res) => requestController.createRequest(req, res));
  router.put('/requests/:id/approve', (req, res) => requestController.approveRequest(req, res));
  router.put('/requests/:id/reject', (req, res) => requestController.rejectRequest(req, res));
  router.put('/requests/:id/schedule', (req, res) => requestController.scheduleRequest(req, res));
  router.put('/requests/:id/complete', (req, res) => requestController.completeRequest(req, res));

  router.get('/stats', (req, res) => statsController.getStats(req, res));

  return router;
}

module.exports = createRouter;
