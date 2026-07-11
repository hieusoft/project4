const Listing = require('../../Domain/Entities/Listing');
const { DomainError, NotFoundError } = require('../Exceptions');

class ListingUseCases {
  constructor({ listingRepository, messagePublisher }) {
    this.listingRepository = listingRepository;
    this.messagePublisher = messagePublisher;
  }

  async createListing(listingData) {
    const listing = new Listing(listingData);
    const createdListing = await this.listingRepository.save(listing);
    
    if (this.messagePublisher) {
      await this.messagePublisher.publishListingCreated({
        listingId: createdListing.id,
        groupId: createdListing.group_id
      });
    }
    
    return createdListing;
  }

  async getCatalog(filters = {}) {
    filters.status = 'active';
    return await this.listingRepository.find(filters);
  }

  async getListingById(id) {
    const listing = await this.listingRepository.findById(id);
    if (!listing) {
      throw new NotFoundError('Listing not found');
    }
    return listing;
  }

  async getListings(filters = {}) {
    return await this.listingRepository.findAll(filters);
  }
}

module.exports = ListingUseCases;
