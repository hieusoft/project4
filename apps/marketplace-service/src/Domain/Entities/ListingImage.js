class ListingImage {
  constructor({ id, listing_id, image_url, sort_order }) {
    this.id = id;
    this.listing_id = listing_id;
    this.image_url = image_url;
    this.sort_order = sort_order || 0;
  }
}

module.exports = ListingImage;
