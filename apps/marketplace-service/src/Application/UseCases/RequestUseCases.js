const { NotFoundError, DomainError, ForbiddenError } = require('../Exceptions');
const ItemRequest = require('../../Domain/Entities/ItemRequest');

class RequestUseCases {
  constructor({
    requestRepository,
    listingRepository,
    messagePublisher,
    deliveryConfirmationRepository,
    donationClient,
    communityClient,
  }) {
    this.requestRepository = requestRepository;
    this.listingRepository = listingRepository;
    this.messagePublisher = messagePublisher;
    this.deliveryConfirmationRepository = deliveryConfirmationRepository;
    this.donationClient = donationClient;
    this.communityClient = communityClient;
  }

  async createRequest(requestData, { userId, token } = {}) {
    const receiverId = userId || requestData.receiver_id;
    if (!receiverId) throw new DomainError('receiver_id required');

    const listing = await this.listingRepository.findById(requestData.listing_id);
    if (!listing) throw new NotFoundError('Listing not found');

    if (!listing.isAvailable(requestData.quantity || 1)) {
      throw new DomainError('Listing does not have enough available quantity');
    }

    // Receiver must be approved member of the group
    if (this.communityClient) {
      const m = await this.communityClient.verifyMembership(
        receiverId,
        listing.group_id,
        token
      );
      if (!m.approved) {
        throw new ForbiddenError('Tham gia nhóm để nhận đồ');
      }
    }

    const code = `REQ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const request = new ItemRequest({
      ...requestData,
      group_id: requestData.group_id || listing.group_id,
      receiver_id: receiverId,
      code,
    });

    const createdRequest = await this.requestRepository.save(request);
    await this.messagePublisher.publishRequestCreated({
      requestId: createdRequest.id,
      listingId: createdRequest.listing_id,
      receiverId: createdRequest.receiver_id,
      groupId: createdRequest.group_id,
    });

    return createdRequest;
  }

  async approveRequest(requestId, reviewerId, { token } = {}) {
    const request = await this.requestRepository.findById(requestId);
    if (!request) throw new NotFoundError('Request not found');

    if (this.communityClient) {
      const ok = await this.communityClient.isModerator(
        reviewerId,
        request.group_id,
        token
      );
      if (!ok) throw new ForbiddenError('Moderator required');
    }

    const listing = await this.listingRepository.findById(request.listing_id);
    if (!listing) throw new NotFoundError('Listing not found');
    if (!listing.isAvailable(request.quantity)) {
      throw new DomainError('Listing does not have enough available quantity');
    }

    request.approve(reviewerId);
    // Design: decrease quantity on approve
    listing.reserve(request.quantity);

    const updatedRequest = await this.requestRepository.updateWithListing(request, listing);

    if (this.donationClient && listing.inventory_item_id) {
      await this.donationClient.updateItemStatus(
        listing.inventory_item_id,
        'reserved',
        { refType: 'request', refId: request.id },
        token
      );
    }

    await this.messagePublisher.publishRequestApproved({
      requestId: updatedRequest.id,
      listingId: updatedRequest.listing_id,
      receiverId: updatedRequest.receiver_id,
      groupId: updatedRequest.group_id,
    });

    return updatedRequest;
  }

  async rejectRequest(requestId, reviewerId, reason, { token } = {}) {
    const request = await this.requestRepository.findById(requestId);
    if (!request) throw new NotFoundError('Request not found');

    if (this.communityClient) {
      const ok = await this.communityClient.isModerator(
        reviewerId,
        request.group_id,
        token
      );
      if (!ok) throw new ForbiddenError('Moderator required');
    }

    request.reject(reviewerId, reason);
    const updatedRequest = await this.requestRepository.update(request);

    await this.messagePublisher.publishRequestRejected({
      requestId: updatedRequest.id,
      receiverId: updatedRequest.receiver_id,
      groupId: updatedRequest.group_id,
      reason: updatedRequest.reject_reason,
    });

    return updatedRequest;
  }

  async scheduleRequest(requestId, reviewerId, date, { token } = {}) {
    const request = await this.requestRepository.findById(requestId);
    if (!request) throw new NotFoundError('Request not found');

    if (this.communityClient) {
      const ok = await this.communityClient.isModerator(
        reviewerId,
        request.group_id,
        token
      );
      if (!ok) throw new ForbiddenError('Moderator required');
    }

    request.schedule(reviewerId, date);
    const updatedRequest = await this.requestRepository.update(request);
    await this.messagePublisher.publishRequestScheduled({
      requestId: updatedRequest.id,
      listingId: updatedRequest.listing_id,
      receiverId: updatedRequest.receiver_id,
      groupId: updatedRequest.group_id,
      scheduledAt: updatedRequest.scheduled_at,
    });

    return updatedRequest;
  }

  async completeRequest(requestId, completionData, { userId, token } = {}) {
    const request = await this.requestRepository.findById(requestId);
    if (!request) throw new NotFoundError('Request not found');

    const reviewerId = completionData.confirmed_by || userId;
    if (this.communityClient && reviewerId) {
      const ok = await this.communityClient.isModerator(
        reviewerId,
        request.group_id,
        token
      );
      if (!ok) throw new ForbiddenError('Moderator required to complete delivery');
    }

    request.complete();
    const listing = await this.listingRepository.findById(request.listing_id);
    // qty already decreased on approve — do not reserve again

    const result = await this.requestRepository.completeWithTransaction(
      request,
      listing,
      completionData
    );

    if (this.donationClient && listing && listing.inventory_item_id) {
      await this.donationClient.updateItemStatus(
        listing.inventory_item_id,
        'delivered',
        { refType: 'request', refId: request.id },
        token
      );
    }

    await this.messagePublisher.publishRequestCompleted({
      requestId: result.request.id,
      listingId: result.request.listing_id,
      receiverId: result.request.receiver_id,
      donorId: listing ? listing.created_by : null,
      groupId: result.request.group_id,
    });

    return result.request;
  }

  async cancelRequest(requestId, { userId, token } = {}) {
    const request = await this.requestRepository.findById(requestId);
    if (!request) throw new NotFoundError('Request not found');

    const isReceiver = String(request.receiver_id) === String(userId);
    let isMod = false;
    if (this.communityClient && userId) {
      isMod = await this.communityClient.isModerator(userId, request.group_id, token);
    }
    if (!isReceiver && !isMod) {
      throw new ForbiddenError('Only receiver or moderator can cancel');
    }

    const prev = request.status;
    request.cancel(userId);

    const listing = await this.listingRepository.findById(request.listing_id);
    // Restore qty if already reserved (approved/scheduled)
    if (listing && (prev === 'approved' || prev === 'scheduled')) {
      listing.release(request.quantity);
    }

    const updated = await this.requestRepository.updateWithListing(
      request,
      prev === 'approved' || prev === 'scheduled' ? listing : null
    );

    if (
      this.donationClient &&
      listing &&
      listing.inventory_item_id &&
      (prev === 'approved' || prev === 'scheduled')
    ) {
      await this.donationClient.updateItemStatus(
        listing.inventory_item_id,
        listing.quantity_available > 0 ? 'listed' : 'in_stock',
        { refType: 'request', refId: request.id, note: 'Request cancelled' },
        token
      );
    }

    return updated;
  }

  async noShowRequest(requestId, reviewerId, { token } = {}) {
    const request = await this.requestRepository.findById(requestId);
    if (!request) throw new NotFoundError('Request not found');

    if (this.communityClient) {
      const ok = await this.communityClient.isModerator(
        reviewerId,
        request.group_id,
        token
      );
      if (!ok) throw new ForbiddenError('Moderator required');
    }

    request.noShow(reviewerId);
    const listing = await this.listingRepository.findById(request.listing_id);
    if (listing) {
      listing.release(request.quantity);
    }

    const updated = await this.requestRepository.updateWithListing(request, listing);

    if (this.donationClient && listing && listing.inventory_item_id) {
      await this.donationClient.updateItemStatus(
        listing.inventory_item_id,
        listing.quantity_available > 0 ? 'listed' : 'in_stock',
        { refType: 'request', refId: request.id, note: 'no_show' },
        token
      );
    }

    return updated;
  }

  async getRequests(filters = {}) {
    return await this.requestRepository.find(filters);
  }

  async getDeliveryConfirmation(requestId) {
    if (!this.deliveryConfirmationRepository) return null;
    return await this.deliveryConfirmationRepository.findByRequestId(requestId);
  }
}

module.exports = RequestUseCases;
