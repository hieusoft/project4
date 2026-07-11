class ApproveRequestDTO {
  constructor(data) {
    this.reviewed_by = data.reviewed_by;
  }

  validate() {
    if (!this.reviewed_by) throw new Error("reviewed_by is required");
  }
}

module.exports = ApproveRequestDTO;
