const ApiResponse = require('../Responses/ApiResponse');
const CreateListingDTO = require('../../Application/DTOs/CreateListingDTO');

class ListingController {
  constructor({ listingUseCases }) {
    this.listingUseCases = listingUseCases;
  }

  _auth(req) {
    const userId = (req.user && (req.user.sub || req.user.id)) || null;
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;
    return { userId, token };
  }

  async getListings(req, res) {
    try {
      const result = await this.listingUseCases.getListings(req.query);
      return ApiResponse.success(res, result.data, 200, result.meta);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err, err.statusCode || 500);
    }
  }

  async getListingById(req, res) {
    try {
      const listing = await this.listingUseCases.getListingById(req.params.id);
      return ApiResponse.success(res, listing);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err);
    }
  }

  async getCatalog(req, res) {
    try {
      const result = await this.listingUseCases.getCatalog(req.query);
      return ApiResponse.success(res, result.data, 200, result.meta);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err, err.statusCode || 500);
    }
  }

  async createListing(req, res) {
    try {
      const dto = new CreateListingDTO({
        ...req.body,
        created_by: req.body.created_by || (req.user && req.user.sub),
      });
      dto.validate();
      const auth = this._auth(req);
      const listing = await this.listingUseCases.createListing(dto, auth);
      return ApiResponse.success(res, listing, 201);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err);
    }
  }

  async closeListing(req, res) {
    try {
      const auth = this._auth(req);
      const listing = await this.listingUseCases.closeListing(req.params.id, auth);
      return ApiResponse.success(res, listing);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err);
    }
  }
}

module.exports = ListingController;
