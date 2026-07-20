const Listing = require('../../Domain/Entities/Listing');
const { DomainError, NotFoundError, ForbiddenError } = require('../Exceptions');

class ListingUseCases {
  constructor({ listingRepository, messagePublisher, donationClient, communityClient }) {
    this.listingRepository = listingRepository;
    this.messagePublisher = messagePublisher;
    this.donationClient = donationClient;
    this.communityClient = communityClient;
  }

  async createListing(listingData, { userId, token } = {}) {
    const actorId = userId || listingData.created_by;
    if (!actorId) throw new DomainError('created_by / user required');

    // Verify moderator of group
    if (this.communityClient) {
      const isMod = await this.communityClient.isModerator(
        actorId,
        listingData.group_id,
        token
      );
      if (!isMod) {
        throw new ForbiddenError('Only group owner/moderator can create listings');
      }
    }

    // Verify inventory in_stock from Donation
    if (this.donationClient && listingData.inventory_item_id) {
      const inv = await this.donationClient.getInventoryItem(
        listingData.inventory_item_id,
        token
      );
      if (!inv) throw new NotFoundError('Inventory item not found');
      if (inv.status && inv.status !== 'in_stock') {
        throw new DomainError(`Inventory item is not in_stock (status=${inv.status})`);
      }
      // Fill defaults from inventory when missing
      if (!listingData.category_id && inv.category_id) {
        listingData.category_id = inv.category_id;
      }
      if (!listingData.condition && inv.condition) {
        listingData.condition = inv.condition;
      }
      if (!listingData.title && inv.name) {
        listingData.title = inv.name;
      }
      if (inv.group_id && String(inv.group_id) !== String(listingData.group_id)) {
        throw new DomainError('Inventory item does not belong to this group');
      }
      if (listingData.quantity_total == null && inv.quantity) {
        listingData.quantity_total = inv.quantity;
      }
    }

    listingData.created_by = actorId;
    listingData.quantity_available =
      listingData.quantity_available !== undefined
        ? listingData.quantity_available
        : listingData.quantity_total || 1;

    const listing = new Listing(listingData);
    const createdListing = await this.listingRepository.save(listing);

    // Mark inventory as listed
    if (this.donationClient && createdListing.inventory_item_id) {
      await this.donationClient.updateItemStatus(
        createdListing.inventory_item_id,
        'listed',
        { refType: 'listing', refId: createdListing.id },
        token
      );
    }

    if (this.messagePublisher) {
      await this.messagePublisher.publishListingCreated({
        listingId: createdListing.id,
        inventoryItemId: createdListing.inventory_item_id,
        groupId: createdListing.group_id,
      });
    }

    return createdListing;
  }

  async closeListing(listingId, { userId, token } = {}) {
    const listing = await this.listingRepository.findById(listingId);
    if (!listing) throw new NotFoundError('Listing not found');

    if (this.communityClient && userId) {
      const isMod = await this.communityClient.isModerator(userId, listing.group_id, token);
      if (!isMod) throw new ForbiddenError('Moderator required to close listing');
    }

    if (listing.status === 'closed') return listing;
    listing.close();
    const updated = await this.listingRepository.update(listing);

    // Return inventory to in_stock if still reserved/listed and has qty
    if (this.donationClient && listing.inventory_item_id && listing.quantity_available > 0) {
      await this.donationClient.updateItemStatus(
        listing.inventory_item_id,
        'in_stock',
        { refType: 'listing', refId: listing.id, note: 'Listing closed' },
        token
      );
    }
    return updated;
  }

  async getCatalog(filters = {}) {
    filters.status = 'active';
    return await this.listingRepository.find(filters);
  }

  async getListingById(id) {
    const listing = await this.listingRepository.findById(id);
    if (!listing) throw new NotFoundError('Listing not found');
    return listing;
  }

  async getListings(filters = {}) {
    return await this.listingRepository.findAll(filters);
  }
}

module.exports = ListingUseCases;
