class Listing {
  constructor({
    id,
    inventory_item_id,
    group_id,
    title,
    description,
    category_id,
    condition,
    quantity_total,
    quantity_available,
    province_code,
    district_code,
    status,
    view_count,
    created_by,
    created_at,
    updated_at,
    images = [],
  }) {
    this.id = id;
    this.inventory_item_id = inventory_item_id;
    this.group_id = group_id;
    this.title = title;
    this.description = description;
    this.category_id = category_id;
    this.condition = condition;
    this.quantity_total = quantity_total || 1;
    this.quantity_available =
      quantity_available !== undefined && quantity_available !== null
        ? quantity_available
        : this.quantity_total;
    this.province_code = province_code;
    this.district_code = district_code;
    this.status = status || 'active';
    this.view_count = view_count || 0;
    this.created_by = created_by;
    this.created_at = created_at;
    this.updated_at = updated_at;
    this.images = images;
  }

  /** Decrease available qty (on approve). */
  reserve(quantity) {
    if (this.quantity_available < quantity) {
      throw new Error('Not enough available quantity');
    }
    this.quantity_available -= quantity;
    if (this.quantity_available === 0) {
      this.status = 'reserved';
    }
  }

  /** Restore qty (cancel / no_show / reject after approve). */
  release(quantity) {
    this.quantity_available += quantity;
    if (this.quantity_available > this.quantity_total) {
      this.quantity_available = this.quantity_total;
    }
    if (this.status === 'reserved' && this.quantity_available > 0) {
      this.status = 'active';
    }
  }

  close() {
    this.status = 'closed';
  }

  isAvailable(quantity = 1) {
    return this.status === 'active' && this.quantity_available >= quantity;
  }
}

module.exports = Listing;
