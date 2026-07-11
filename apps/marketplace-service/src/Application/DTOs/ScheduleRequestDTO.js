class ScheduleRequestDTO {
  constructor(data) {
    this.reviewed_by = data.reviewed_by;
    this.scheduled_at = data.scheduled_at;
  }

  validate() {
    if (!this.reviewed_by) throw new Error("reviewed_by is required");
    if (!this.scheduled_at) throw new Error("scheduled_at is required");
  }
}

module.exports = ScheduleRequestDTO;
