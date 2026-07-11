const ListingImage = require('../../Domain/Entities/ListingImage');

class ListingImageUseCases {
  constructor({ listingImageRepository }) {
    this.listingImageRepository = listingImageRepository;
  }

  async addImages(listingId, images) {
    const savedImages = [];
    for (let i = 0; i < images.length; i++) {
      const img = new ListingImage({
        listing_id: listingId,
        image_url: images[i],
        sort_order: i
      });
      const saved = await this.listingImageRepository.save(img);
      savedImages.push(saved);
    }
    return savedImages;
  }

  async deleteImage(id) {
    await this.listingImageRepository.deleteById(id);
  }

  async getImages(listingId) {
    return await this.listingImageRepository.findByListingId(listingId);
  }
}

module.exports = ListingImageUseCases;
