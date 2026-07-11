const ApiResponse = require('../Responses/ApiResponse');
const CreateListingDTO = require('../../Application/DTOs/CreateListingDTO');

class ListingController {
  constructor({ listingUseCases }) {
    this.listingUseCases = listingUseCases;
    
    
    
  }

  async getListingsUseCase(req, res) {
    try {
      const listings = await this.listingUseCases.getListings(req.query);
      return ApiResponse.success(res, listings);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err, 500);
    }
  }

  async getListingByIdUseCase(req, res) {
    try {
      const listing = await this.listingUseCases.getListingById(req.params.id);
      return ApiResponse.success(res, listing);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err);
    }
  }

  async getCatalogUseCase(req, res) {
    try {
      const listings = await this.listingUseCases.getCatalog(req.query);
      return ApiResponse.success(res, listings);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err, 500);
    }
  }

  async createListingUseCase(req, res) {
    try {
      const dto = new CreateListingDTO(req.body);
      dto.validate();
      
      const listing = await this.listingUseCases.createListing(dto);
      return ApiResponse.success(res, listing, 201);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err);
    }
  }
}

module.exports = ListingController;
