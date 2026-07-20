class CreateRequestDTO {
  constructor(data) {
    this.listing_id = data.listing_id;
    this.group_id = data.group_id;
    this.receiver_id = data.receiver_id;
    this.quantity = data.quantity || 1;
    this.reason = data.reason;
  }

  validate() {
    if (!this.listing_id) throw new Error('listing_id is required');
    if (!this.receiver_id) throw new Error('receiver_id is required');
    if (this.quantity <= 0) throw new Error('quantity must be greater than 0');
  }
}

module.exports = CreateRequestDTO;
