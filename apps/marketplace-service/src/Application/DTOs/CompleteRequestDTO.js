class CompleteRequestDTO {
  constructor(data) {
    this.confirmed_by = data.confirmed_by;
    this.qr_token = data.qr_token;
    this.photo_url = data.photo_url;
    this.note = data.note;
  }

  validate() {
    if (!this.confirmed_by) throw new Error("confirmed_by is required");
    if (!this.qr_token) throw new Error("qr_token is required");
  }
}

module.exports = CompleteRequestDTO;
