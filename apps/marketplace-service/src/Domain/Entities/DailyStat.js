class DailyStat {
  constructor({
    id,
    stat_date,
    group_id,
    donations_count,
    items_received,
    items_listed,
    items_delivered,
    requests_count,
    people_helped,
    new_users,
    new_members
  }) {
    this.id = id;
    this.stat_date = stat_date;
    this.group_id = group_id;
    this.donations_count = donations_count || 0;
    this.items_received = items_received || 0;
    this.items_listed = items_listed || 0;
    this.items_delivered = items_delivered || 0;
    this.requests_count = requests_count || 0;
    this.people_helped = people_helped || 0;
    this.new_users = new_users || 0;
    this.new_members = new_members || 0;
  }
}

module.exports = DailyStat;
