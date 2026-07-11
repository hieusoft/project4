class DeliveryConfirmation {
  constructor({ id, request_id, confirmed_by, qr_token, photo_url, note, confirmed_at }) {
    this.id = id;
    this.request_id = request_id;
    this.confirmed_by = confirmed_by;
    this.qr_token = qr_token;
    this.photo_url = photo_url;
    this.note = note;
    this.confirmed_at = confirmed_at;
  }
}

module.exports = DeliveryConfirmation;
