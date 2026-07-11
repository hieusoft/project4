const ListingImage = require('../../../Domain/Entities/ListingImage');
const IListingImageRepository = require('../../../Application/Interfaces/IListingImageRepository');

class ListingImageRepository extends IListingImageRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  async findByListingId(listingId) {
    const { rows } = await this.db.query(
      'SELECT * FROM listing_images WHERE listing_id = $1 ORDER BY sort_order ASC',
      [listingId]
    );
    return rows.map(row => new ListingImage(row));
  }

  async findByListingIds(listingIds) {
    if (!listingIds || listingIds.length === 0) return [];
    const { rows } = await this.db.query(
      'SELECT * FROM listing_images WHERE listing_id = ANY($1) ORDER BY sort_order ASC',
      [listingIds]
    );
    return rows.map(row => new ListingImage(row));
  }

  async save(listingId, images) {
    const savedImages = [];
    for (const [index, img] of images.entries()) {
      const { rows } = await this.db.query(
        `INSERT INTO listing_images (listing_id, image_url, sort_order)
         VALUES ($1, $2, $3) RETURNING *`,
        [listingId, img.image_url || img, img.sort_order || index]
      );
      savedImages.push(new ListingImage(rows[0]));
    }
    return savedImages;
  }

  async deleteById(imageId) {
    await this.db.query('DELETE FROM listing_images WHERE id = $1', [imageId]);
  }

  async deleteByListingId(listingId) {
    await this.db.query('DELETE FROM listing_images WHERE listing_id = $1', [listingId]);
  }
}

module.exports = ListingImageRepository;
