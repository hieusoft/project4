const Listing = require('../../Domain/Entities/Listing');
const { DomainError, NotFoundError } = require('../Exceptions');

class ListingUseCases {
  constructor({ listingRepository, donationClient, communityClient, messagePublisher }) {
    this.listingRepository = listingRepository;
    this.donationClient = donationClient;
    this.communityClient = communityClient;
    this.messagePublisher = messagePublisher;
  }

  async createListing(listingData) {
    if (this.donationClient && listingData.inventory_item_id) {
      const inventoryItem = await this.donationClient.getInventoryItem(listingData.inventory_item_id);
      if (!inventoryItem) {
        throw new DomainError('Inventory item not found in Donation Service');
      }
      if (inventoryItem.status !== 'in_stock') {
        throw new DomainError('Inventory item is not in stock');
      }
      // Populate fields from inventory item if needed
      if (!listingData.category_id && inventoryItem.category_id) {
        listingData.category_id = inventoryItem.category_id;
      }
      if (!listingData.condition && inventoryItem.condition) {
        listingData.condition = inventoryItem.condition;
      }
    }

    if (this.communityClient && listingData.group_id && !listingData.province_code) {
      try {
        const groupRes = await this.communityClient.getGroup(listingData.group_id);
        const group = groupRes.data || groupRes;
        if (group && group.province_code) {
          listingData.province_code = group.province_code;
        }
      } catch (err) {
        console.warn(`Failed to fetch group ${listingData.group_id} for province_code:`, err.message);
      }
    }

    const listing = new Listing(listingData);
    const createdListing = await this.listingRepository.save(listing);
    
    if (this.donationClient && listingData.inventory_item_id) {
      await this.donationClient.updateItemStatus(listingData.inventory_item_id, 'listed', { refType: 'listing', refId: createdListing.id });
    }

    if (this.messagePublisher) {
      await this.messagePublisher.publishListingCreated({
        listingId: createdListing.id,
        groupId: createdListing.group_id
      });
    }
    
    return createdListing;
  }

  async closeListing(listingId, userId) {
    const listing = await this.listingRepository.findById(listingId);
    if (!listing) throw new NotFoundError('Listing not found');

    // Add authorization logic if necessary, e.g. only creator can close
    listing.status = 'closed';
    const updatedListing = await this.listingRepository.update(listing);
    
    if (this.messagePublisher) {
      await this.messagePublisher.publishListingClosed({
        listingId: updatedListing.id,
        groupId: updatedListing.group_id
      });
    }

    return updatedListing;
  }

  async updateListing(listingId, listingData, userId) {
    const listing = await this.listingRepository.findById(listingId);
    if (!listing) throw new NotFoundError('Listing not found');

    // Update fields (excluding critical ones like quantity_available if not explicitly allowed)
    if (listingData.title !== undefined) listing.title = listingData.title;
    if (listingData.description !== undefined) listing.description = listingData.description;
    if (listingData.condition !== undefined) listing.condition = listingData.condition;
    if (listingData.category_id !== undefined) listing.category_id = listingData.category_id;

    return await this.listingRepository.update(listing);
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

  async blockListing(listingId) {
    const listing = await this.listingRepository.findById(listingId);
    if (!listing) {
      console.warn(`Listing ${listingId} not found, cannot block.`);
      return null;
    }
    
    listing.status = 'blocked';
    return await this.listingRepository.update(listing);
  }
}

module.exports = ListingUseCases;
