const express = require('express');
const { requireAuth } = require('../Middleware/AuthMiddleware');

function createRouter({ listingController, requestController, statsController, listingImageController }) {
  const router = express.Router();

  router.get('/catalog', (req, res) => listingController.getCatalog(req, res));
  router.get('/listings', (req, res) => listingController.getListings(req, res));
  router.get('/listings/:id', (req, res) => listingController.getListingById(req, res));
  router.post('/listings', requireAuth, (req, res) => listingController.createListing(req, res));
  router.put('/listings/:id', requireAuth, (req, res) => listingController.updateListing(req, res));
  router.put('/listings/:id/close', requireAuth, (req, res) => listingController.closeListing(req, res));

  router.get('/listings/:id/images', (req, res) => listingImageController.getImages(req, res));
  router.post('/listings/:id/images', requireAuth, (req, res) => listingImageController.addImages(req, res));
  router.delete('/images/:imageId', requireAuth, (req, res) => listingImageController.deleteImage(req, res));

  router.get('/requests', requireAuth, (req, res) => requestController.getRequests(req, res));
  router.post('/requests', requireAuth, (req, res) => requestController.createRequest(req, res));
  router.put('/requests/:id/approve', requireAuth, (req, res) => requestController.approveRequest(req, res));
  router.put('/requests/:id/reject', requireAuth, (req, res) => requestController.rejectRequest(req, res));
  router.put('/requests/:id/schedule', requireAuth, (req, res) => requestController.scheduleRequest(req, res));
  router.put('/requests/:id/complete', requireAuth, (req, res) => requestController.completeRequest(req, res));
  router.put('/requests/:id/cancel', requireAuth, (req, res) => requestController.cancelRequest(req, res));
  router.put('/requests/:id/no_show', requireAuth, (req, res) => requestController.noShowRequest(req, res));
  router.get('/requests/:id/confirmation', requireAuth, (req, res) => requestController.getDeliveryConfirmation(req, res));

  router.get('/stats/summary', (req, res) => statsController.getSummary(req, res));
  router.get('/stats', (req, res) => statsController.getStats(req, res));

  return router;
}

module.exports = createRouter;
