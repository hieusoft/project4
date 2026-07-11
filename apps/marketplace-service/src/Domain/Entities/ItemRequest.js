class ItemRequest {
  constructor({
    id,
    code,
    listing_id,
    group_id,
    receiver_id,
    quantity,
    reason,
    status,
    reviewed_by,
    reviewed_at,
    reject_reason,
    scheduled_at,
    completed_at,
    created_at,
    updated_at
  }) {
    this.id = id;
    this.code = code;
    this.listing_id = listing_id;
    this.group_id = group_id;
    this.receiver_id = receiver_id;
    this.quantity = quantity || 1;
    this.reason = reason;
    this.status = status || 'pending';
    this.reviewed_by = reviewed_by;
    this.reviewed_at = reviewed_at;
    this.reject_reason = reject_reason;
    this.scheduled_at = scheduled_at;
    this.completed_at = completed_at;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }

  approve(reviewerId) {
    if (this.status !== 'pending') {
      throw new Error('Can only approve pending requests');
    }
    this.status = 'approved';
    this.reviewed_by = reviewerId;
    this.reviewed_at = new Date();
  }

  reject(reviewerId, reason) {
    if (this.status !== 'pending') {
      throw new Error('Can only reject pending requests');
    }
    this.status = 'rejected';
    this.reviewed_by = reviewerId;
    this.reviewed_at = new Date();
    this.reject_reason = reason;
  }

  schedule(reviewerId, date) {
    if (this.status !== 'approved') {
      throw new Error('Can only schedule approved requests');
    }
    this.status = 'scheduled';
    this.reviewed_by = reviewerId;
    this.scheduled_at = new Date(date);
  }

  complete() {
    if (this.status !== 'approved' && this.status !== 'scheduled') {
      throw new Error('Request must be approved or scheduled to be completed');
    }
    this.status = 'completed';
    this.completed_at = new Date();
  }
}

module.exports = ItemRequest;
