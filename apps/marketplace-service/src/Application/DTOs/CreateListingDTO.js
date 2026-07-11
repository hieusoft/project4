class CreateListingDTO {
  constructor(data) {
    this.inventory_item_id = data.inventory_item_id;
    this.group_id = data.group_id;
    this.title = data.title;
    this.description = data.description;
    this.category_id = data.category_id;
    this.condition = data.condition;
    this.quantity_total = data.quantity_total || 1;
    this.province_code = data.province_code;
    this.district_code = data.district_code;
    this.created_by = data.created_by;
    this.images = data.images || [];
  }

  validate() {
    if (!this.inventory_item_id) throw new Error("inventory_item_id is required");
    if (!this.group_id) throw new Error("group_id is required");
    if (!this.title) throw new Error("title is required");
    if (!this.category_id) throw new Error("category_id is required");
    if (!this.condition) throw new Error("condition is required");
    if (!this.created_by) throw new Error("created_by is required");
  }
}

module.exports = CreateListingDTO;
