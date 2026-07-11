class IListingImageRepository {
  async findByListingId(listingId) { throw new Error("Method not implemented."); }
  async findByListingIds(listingIds) { throw new Error("Method not implemented."); }
  async save(listingId, images) { throw new Error("Method not implemented."); }
  async deleteById(imageId) { throw new Error("Method not implemented."); }
  async deleteByListingId(listingId) { throw new Error("Method not implemented."); }
}
module.exports = IListingImageRepository;
