const { NotFoundError, DomainError } = require('../Exceptions');
const ItemRequest = require('../../Domain/Entities/ItemRequest');

class RequestUseCases {
  constructor({ requestRepository, listingRepository, messagePublisher, deliveryConfirmationRepository }) {
    this.requestRepository = requestRepository;
    this.listingRepository = listingRepository;
    this.messagePublisher = messagePublisher;
    this.deliveryConfirmationRepository = deliveryConfirmationRepository;
  }

  async approveRequest(requestId, reviewerId) {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundError('Request not found');
    }

    request.approve(reviewerId);
    const updatedRequest = await this.requestRepository.update(request);

    await this.messagePublisher.publishRequestApproved({
      requestId: updatedRequest.id,
      receiverId: updatedRequest.receiver_id,
      groupId: updatedRequest.group_id
    });
    
    return updatedRequest;
  }

  async completeRequest(requestId, completionData) {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundError('Request not found');
    }

    request.complete();
    
    const listing = await this.listingRepository.findById(request.listing_id);
    if (listing) {
      listing.reserve(request.quantity);
    }

    const result = await this.requestRepository.completeWithTransaction(request, listing, completionData);

    let donorId = listing ? listing.created_by : null;

    await this.messagePublisher.publishRequestCompleted({
      requestId: result.request.id,
      receiverId: result.request.receiver_id,
      donorId: donorId
    });
    
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

    const code = `REQ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const request = new ItemRequest({ ...requestData, code });
    
    const createdRequest = await this.requestRepository.save(request);
    await this.messagePublisher.publishRequestCreated({
      requestId: createdRequest.id,
      groupId: createdRequest.group_id
    });
    
    return createdRequest;
  }

  async getRequests(filters = {}) {
    return await this.requestRepository.find(filters);
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
