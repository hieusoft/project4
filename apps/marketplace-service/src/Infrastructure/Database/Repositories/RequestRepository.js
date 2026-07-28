const ItemRequest = require('../../../Domain/Entities/ItemRequest');
const Listing = require('../../../Domain/Entities/Listing');
const IRequestRepository = require('../../../Application/Interfaces/IRequestRepository');

class RequestRepository extends IRequestRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  async find(filters = {}) {
    let queryText = 'SELECT * FROM item_requests WHERE 1=1';
    let countQueryText = 'SELECT COUNT(*) FROM item_requests WHERE 1=1';
    const params = [];
    
    if (filters.group_id) {
      params.push(filters.group_id);
      queryText += ` AND group_id = $${params.length}`;
      countQueryText += ` AND group_id = $${params.length}`;
    }
    
    if (filters.listing_id) {
      params.push(filters.listing_id);
      queryText += ` AND listing_id = $${params.length}`;
      countQueryText += ` AND listing_id = $${params.length}`;
    }

    if (filters.status) {
      params.push(filters.status);
      queryText += ` AND status = $${params.length}`;
      countQueryText += ` AND status = $${params.length}`;
    }

    if (filters.receiver_id) {
      params.push(filters.receiver_id);
      queryText += ` AND receiver_id = $${params.length}`;
      countQueryText += ` AND receiver_id = $${params.length}`;
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
    const data = rows.map(row => new ItemRequest(row));
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

  async findById(id) {
    const { rows } = await this.db.query('SELECT * FROM item_requests WHERE id = $1', [id]);
    if (rows.length === 0) return null;
    return new ItemRequest(rows[0]);
  }

  async save(request) {
    const queryText = `
      INSERT INTO item_requests (
        code, listing_id, group_id, receiver_id, quantity, reason, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const params = [
      request.code, request.listing_id, request.group_id, request.receiver_id, 
      request.quantity, request.reason, request.status
    ];
    
    const { rows } = await this.db.query(queryText, params);
    return new ItemRequest(rows[0]);
  }

  async update(request) {
    const queryText = `
      UPDATE item_requests 
      SET status = $1, reviewed_by = $2, reviewed_at = $3, reject_reason = $4, scheduled_at = $5, updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `;
    const params = [
      request.status, request.reviewed_by, request.reviewed_at, 
      request.reject_reason, request.scheduled_at, request.id
    ];
    
    const { rows } = await this.db.query(queryText, params);
    return new ItemRequest(rows[0]);
  }

  /** Atomically reserve stock and approve a request. */
  async approveWithListing(request) {
    const client = await this.db.getClient();
    try {
      await client.query('BEGIN');
      const { rows: listingRows } = await client.query(
        'SELECT * FROM listings WHERE id = $1 FOR UPDATE',
        [request.listing_id]
      );
      if (!listingRows.length) throw new Error('Listing not found');

      const listing = listingRows[0];
      if (
        listing.status !== 'active' ||
        Number(listing.quantity_available) < request.quantity
      ) {
        throw new Error('Listing does not have enough available quantity');
      }

      const nextQuantity = Number(listing.quantity_available) - request.quantity;
      const nextStatus = nextQuantity === 0 ? 'reserved' : 'active';
      await client.query(
        `UPDATE listings
         SET quantity_available = $1, status = $2, updated_at = NOW()
         WHERE id = $3`,
        [nextQuantity, nextStatus, request.listing_id]
      );
      const { rows: requestRows } = await client.query(
        `UPDATE item_requests
         SET status = $1, reviewed_by = $2, reviewed_at = $3, updated_at = NOW()
         WHERE id = $4 AND status = 'pending'
         RETURNING *`,
        [request.status, request.reviewed_by, request.reviewed_at, request.id]
      );
      if (!requestRows.length) throw new Error('Request is no longer pending');

      await client.query('COMMIT');
      return {
        request: new ItemRequest(requestRows[0]),
        listing: new Listing({
          ...listing,
          quantity_available: nextQuantity,
          status: nextStatus,
        }),
      };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async completeWithTransaction(request, listing, completionData) {
    const client = await this.db.getClient();
    try {
      await client.query('BEGIN');

      const reqQuery = `
        UPDATE item_requests
        SET status = $1, completed_at = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `;
      const { rows: reqRows } = await client.query(reqQuery, [
        request.status,
        request.completed_at,
        request.id,
      ]);
      const updatedRequest = new ItemRequest(reqRows[0]);

      const { rows: listingRows } = await client.query(
        'SELECT * FROM listings WHERE id = $1 FOR UPDATE',
        [request.listing_id]
      );
      if (!listingRows.length) throw new Error('Listing not found');
      const updatedListing = new Listing(listingRows[0]);

      const { rows: reservationRows } = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM item_requests
         WHERE listing_id = $1 AND status IN ('approved', 'scheduled')`,
        [request.listing_id]
      );
      updatedListing.finalizeDelivery(reservationRows[0].count > 0);

      const confQuery = `
        INSERT INTO delivery_confirmations (request_id, confirmed_by, qr_token, photo_url, note)
        VALUES ($1, $2, $3, $4, $5)
      `;
      await client.query(confQuery, [
        request.id,
        completionData.confirmed_by,
        completionData.qr_token,
        completionData.photo_url,
        completionData.note,
      ]);

      await client.query(
        `UPDATE listings
         SET status = $1, updated_at = NOW()
         WHERE id = $2`,
        [updatedListing.status, updatedListing.id]
      );

      await client.query('COMMIT');
      return { request: updatedRequest, listing: updatedListing };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /** Update request + listing qty/status in one transaction (approve/cancel/no_show). */
  async updateWithListing(request, listing) {
    const client = await this.db.getClient();
    try {
      await client.query('BEGIN');
      const { rows: reqRows } = await client.query(
        `
        UPDATE item_requests
        SET status = $1, reviewed_by = $2, reviewed_at = $3, reject_reason = $4,
            scheduled_at = $5, completed_at = $6, updated_at = NOW()
        WHERE id = $7
        RETURNING *
        `,
        [
          request.status,
          request.reviewed_by,
          request.reviewed_at,
          request.reject_reason,
          request.scheduled_at,
          request.completed_at || null,
          request.id,
        ]
      );
      if (listing) {
        await client.query(
          `
          UPDATE listings
          SET quantity_available = $1, status = $2, updated_at = NOW()
          WHERE id = $3
          `,
          [listing.quantity_available, listing.status, listing.id]
        );
      }
      await client.query('COMMIT');
      return new ItemRequest(reqRows[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}


module.exports = RequestRepository;
