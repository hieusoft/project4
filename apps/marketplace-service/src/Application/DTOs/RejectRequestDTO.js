class RejectRequestDTO {
  constructor(data) {
    this.reviewed_by = data.reviewed_by;
    this.reason = data.reason;
  }

  validate() {
    if (!this.reviewed_by) throw new Error("reviewed_by is required");
    if (!this.reason) throw new Error("reason is required");
  }
}

module.exports = RejectRequestDTO;
