const { NotFoundError, DomainError } = require('../Exceptions');
const ItemRequest = require('../../Domain/Entities/ItemRequest');

class RequestUseCases {
  constructor({ requestRepository, listingRepository, communityClient, donationClient, messagePublisher, deliveryConfirmationRepository }) {
    this.requestRepository = requestRepository;
    this.listingRepository = listingRepository;
    this.communityClient = communityClient;
    this.donationClient = donationClient;
    this.messagePublisher = messagePublisher;
    this.deliveryConfirmationRepository = deliveryConfirmationRepository;
  }

  async approveRequest(requestId, reviewerId) {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundError('Request not found');
    }

    request.approve(reviewerId);
    
    const listing = await this.listingRepository.findById(request.listing_id);
    if (listing) {
      listing.reserve(request.quantity); // decrease quantity_available
      if (listing.quantity_available === 0) {
        listing.status = 'reserved';
      }
      await this.listingRepository.update(listing);
      
      if (this.donationClient && listing.inventory_item_id) {
        await this.donationClient.updateItemStatus(listing.inventory_item_id, 'reserved', { refType: 'request', refId: requestId });
      }
    }

    const updatedRequest = await this.requestRepository.update(request);

    if (this.messagePublisher) {
      await this.messagePublisher.publishRequestApproved({
        requestId: updatedRequest.id,
        receiverId: updatedRequest.receiver_id,
        groupId: updatedRequest.group_id
      });
    }
    
    return updatedRequest;
  }

  async completeRequest(requestId, completionData) {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundError('Request not found');
    }
    
    if (!completionData.qr_token) {
      throw new DomainError('QR Token is required to complete delivery');
    }

    request.complete();
    
    const listing = await this.listingRepository.findById(request.listing_id);
    
    // Explicitly create delivery confirmation
    const result = await this.requestRepository.completeWithTransaction(request, listing, completionData);
    
    if (this.donationClient && listing && listing.inventory_item_id) {
      await this.donationClient.updateItemStatus(listing.inventory_item_id, 'delivered', { refType: 'request', refId: requestId });
    }

    let donorId = listing ? listing.created_by : null;

    if (this.messagePublisher) {
      await this.messagePublisher.publishRequestCompleted({
        requestId: result.request.id,
        receiverId: result.request.receiver_id,
        donorId: donorId
      });
    }
    
    return result.request;
  }

  async createRequest(requestData) {
    const listing = await this.listingRepository.findById(requestData.listing_id);
    if (!listing) {
      throw new NotFoundError('Listing not found');
    }

    if (!listing.isAvailable(requestData.quantity)) {
      throw new DomainError('Listing does not have enough available quantity');
    }

    if (this.communityClient) {
      const { approved } = await this.communityClient.verifyMembership(requestData.receiver_id, listing.group_id);
      if (!approved) {
        throw new DomainError('User must be an approved member of the group to request items', 403);
      }
    }

    const code = `REQ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const request = new ItemRequest({ ...requestData, group_id: listing.group_id, code });
    
    const createdRequest = await this.requestRepository.save(request);
    
    if (this.messagePublisher) {
      await this.messagePublisher.publishRequestCreated({
        requestId: createdRequest.id,
        groupId: createdRequest.group_id
      });
    }
    
    return createdRequest;
  }

  async getRequests(filters = {}) {
    return await this.requestRepository.find(filters);
  }

  async cancelRequest(requestId, userId) {
    const request = await this.requestRepository.findById(requestId);
    if (!request) throw new NotFoundError('Request not found');
    
    // Only receiver can cancel, or an admin (ignoring role check here for simplicity as per requirements)
    request.status = 'cancelled';
    const updatedRequest = await this.requestRepository.update(request);

    // Refund listing quantity
    const listing = await this.listingRepository.findById(request.listing_id);
    if (listing) {
      listing.quantity_available += request.quantity;
      if (listing.status === 'reserved' && listing.quantity_available > 0) {
        listing.status = 'active';
      }
      await this.listingRepository.update(listing);
      
      if (this.donationClient && listing.inventory_item_id) {
        await this.donationClient.updateItemStatus(listing.inventory_item_id, 'in_stock', { refType: 'request', refId: requestId });
      }
    }

    if (this.messagePublisher) {
      await this.messagePublisher.publishRequestCancelled({
        requestId: updatedRequest.id,
        receiverId: updatedRequest.receiver_id,
        groupId: updatedRequest.group_id
      });
    }
    return updatedRequest;
  }

  async noShowRequest(requestId, reviewerId) {
    const request = await this.requestRepository.findById(requestId);
    if (!request) throw new NotFoundError('Request not found');
    
    // Marked as no_show by moderator/donor
    request.status = 'no_show';
    const updatedRequest = await this.requestRepository.update(request);

    // Refund listing quantity
    const listing = await this.listingRepository.findById(request.listing_id);
    if (listing) {
      listing.quantity_available += request.quantity;
      if (listing.status === 'reserved' && listing.quantity_available > 0) {
        listing.status = 'active';
      }
      await this.listingRepository.update(listing);
      
      if (this.donationClient && listing.inventory_item_id) {
        await this.donationClient.updateItemStatus(listing.inventory_item_id, 'in_stock', { refType: 'request', refId: requestId });
      }
    }

    if (this.messagePublisher) {
      await this.messagePublisher.publishRequestNoShow({
        requestId: updatedRequest.id,
        receiverId: updatedRequest.receiver_id,
        groupId: updatedRequest.group_id
      });
    }
    return updatedRequest;
  }

  async getDeliveryConfirmation(requestId) {
    if (!this.deliveryConfirmationRepository) return null;
    return await this.deliveryConfirmationRepository.findByRequestId(requestId);
  }

  async rejectRequest(requestId, reviewerId, reason) {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundError('Request not found');
    }

    request.reject(reviewerId, reason);
    const updatedRequest = await this.requestRepository.update(request);

    await this.messagePublisher.publishRequestRejected({
      requestId: updatedRequest.id,
      receiverId: updatedRequest.receiver_id,
      groupId: updatedRequest.group_id,
      reason: updatedRequest.reject_reason
    });
    
    return updatedRequest;
  }

  async scheduleRequest(requestId, reviewerId, date) {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundError('Request not found');
    }

    request.schedule(reviewerId, date);
    const updatedRequest = await this.requestRepository.update(request);
    await this.messagePublisher.publishRequestScheduled({
      requestId: updatedRequest.id,
      receiverId: updatedRequest.receiver_id,
      scheduledAt: updatedRequest.scheduled_at
    });
    
    return updatedRequest;
  }
}

module.exports = RequestUseCases;
