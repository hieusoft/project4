const ApiResponse = require('../Responses/ApiResponse');

class ListingImageController {
  constructor({ listingImageUseCases }) {
    this.listingImageUseCases = listingImageUseCases;
  }

  async addImages(req, res) {
    try {
      const { id } = req.params;
      const { images } = req.body;
      
      if (!images || !Array.isArray(images)) {
        return ApiResponse.error(res, new Error('Images must be an array of URLs'), 400);
      }

      const savedImages = await this.listingImageUseCases.addImages(id, images);
      return ApiResponse.success(res, savedImages, 201);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err);
    }
  }

  async getImages(req, res) {
    try {
      const { id } = req.params;
      const images = await this.listingImageUseCases.getImages(id);
      return ApiResponse.success(res, images);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err);
    }
  }

  async deleteImage(req, res) {
    try {
      const { imageId } = req.params;
      await this.listingImageUseCases.deleteImage(imageId);
      return ApiResponse.success(res, { message: 'Image deleted' });
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err);
    }
  }
}

module.exports = ListingImageController;
