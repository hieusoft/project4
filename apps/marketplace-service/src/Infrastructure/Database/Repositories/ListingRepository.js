const Listing = require('../../../Domain/Entities/Listing');
const ListingImage = require('../../../Domain/Entities/ListingImage');
const IListingRepository = require('../../../Application/Interfaces/IListingRepository');

class ListingRepository extends IListingRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  async findAll(filters = {}) {
    let queryText = 'SELECT * FROM listings WHERE 1=1';
    let countQueryText = 'SELECT COUNT(*) FROM listings WHERE 1=1';
    const params = [];
    
    if (filters.status) {
      params.push(filters.status);
      queryText += ` AND status = $${params.length}`;
      countQueryText += ` AND status = $${params.length}`;
    }
    
    if (filters.group_id) {
      params.push(filters.group_id);
      queryText += ` AND group_id = $${params.length}`;
      countQueryText += ` AND group_id = $${params.length}`;
    }

    if (filters.category_id) {
      params.push(filters.category_id);
      queryText += ` AND category_id = $${params.length}`;
      countQueryText += ` AND category_id = $${params.length}`;
    }

    if (filters.province_code) {
      params.push(filters.province_code);
      queryText += ` AND province_code = $${params.length}`;
      countQueryText += ` AND province_code = $${params.length}`;
    }

    if (filters.district_code) {
      params.push(filters.district_code);
      queryText += ` AND district_code = $${params.length}`;
      countQueryText += ` AND district_code = $${params.length}`;
    }

    // Full-text search on title (uses GIN index idx_listings_search)
    if (filters.search) {
      params.push(filters.search);
      queryText += ` AND to_tsvector('simple', title) @@ plainto_tsquery('simple', $${params.length})`;
      countQueryText += ` AND to_tsvector('simple', title) @@ plainto_tsquery('simple', $${params.length})`;
    }
    
    // Copy the WHERE clauses to count query before adding LIMIT/OFFSET
    const { rows: countRows } = await this.db.query(countQueryText, params);
    const total = parseInt(countRows[0].count, 10);
    
    const page = parseInt(filters.page, 10) || 1;
    const limit = parseInt(filters.limit, 10) || 20;
    const offset = (page - 1) * limit;

    queryText += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const { rows } = await this.db.query(queryText, params);
    
    // Fetch images for all listings
    const listingIds = rows.map(r => r.id);
    let images = [];
    if (listingIds.length > 0) {
      const { rows: imageRows } = await this.db.query(
        'SELECT * FROM listing_images WHERE listing_id = ANY($1)',
        [listingIds]
      );
      images = imageRows;
    }
    
    const data = rows.map(row => {
      const listingImages = images.filter(img => img.listing_id === row.id).map(img => new ListingImage(img));
      return new Listing({ ...row, images: listingImages });
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        total_pages: totalPages
      }
    };
  }

  async find(filters = {}) {
    return this.findAll(filters);
  }

  async findById(id) {
    const { rows } = await this.db.query('SELECT * FROM listings WHERE id = $1', [id]);
    if (rows.length === 0) return null;
    
    const { rows: imageRows } = await this.db.query('SELECT * FROM listing_images WHERE listing_id = $1', [id]);
    const images = imageRows.map(img => new ListingImage(img));
    
    return new Listing({ ...rows[0], images });
  }

  async save(listing) {
    const client = await this.db.getClient();
    try {
      await client.query('BEGIN');
      
      const queryText = `
        INSERT INTO listings (
          inventory_item_id, group_id, title, description, category_id, condition, 
          quantity_total, quantity_available, province_code, district_code, created_by, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
      const params = [
        listing.inventory_item_id, listing.group_id, listing.title, listing.description, 
        listing.category_id, listing.condition, listing.quantity_total, 
        listing.quantity_available, listing.province_code, listing.district_code, 
        listing.created_by, listing.status
      ];
      
      const { rows } = await client.query(queryText, params);
      const savedListing = rows[0];
      const savedImages = [];
      
      if (listing.images && listing.images.length > 0) {
        for (const [index, img] of listing.images.entries()) {
          const imgQuery = `
            INSERT INTO listing_images (listing_id, image_url, sort_order)
            VALUES ($1, $2, $3) RETURNING *
          `;
          const imageUrl = img.image_url || img.upload_id || img;
          const sortOrder = img.sort_order !== undefined ? img.sort_order : index;
          const { rows: imgRows } = await client.query(imgQuery, [savedListing.id, imageUrl, sortOrder]);
          savedImages.push(new ListingImage(imgRows[0]));
        }
      }
      
      await client.query('COMMIT');
      return new Listing({ ...savedListing, images: savedImages });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async update(listing) {
    const queryText = `
      UPDATE listings
      SET 
        title = $1,
        description = $2,
        category_id = $3,
        condition = $4,
        quantity_total = $5,
        quantity_available = $6,
        province_code = $7,
        district_code = $8,
        status = $9,
        view_count = $10,
        updated_at = now()
      WHERE id = $11
      RETURNING *
    `;
    const params = [
      listing.title, listing.description, listing.category_id, listing.condition,
      listing.quantity_total, listing.quantity_available, listing.province_code,
      listing.district_code, listing.status, listing.view_count, listing.id
    ];
    
    const { rows } = await this.db.query(queryText, params);
    
    // For images, we would ideally sync them, but for now we just return the updated listing
    return new Listing(rows[0]);
  }
}

module.exports = ListingRepository;
