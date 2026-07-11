const DeliveryConfirmation = require('../../../Domain/Entities/DeliveryConfirmation');
const IDeliveryConfirmationRepository = require('../../../Application/Interfaces/IDeliveryConfirmationRepository');

class DeliveryConfirmationRepository extends IDeliveryConfirmationRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  async findByRequestId(requestId) {
    const { rows } = await this.db.query(
      'SELECT * FROM delivery_confirmations WHERE request_id = $1',
      [requestId]
    );
    if (rows.length === 0) return null;
    return new DeliveryConfirmation(rows[0]);
  }

  async save(confirmation) {
    const { rows } = await this.db.query(
      `INSERT INTO delivery_confirmations (request_id, confirmed_by, qr_token, photo_url, note)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        confirmation.request_id,
        confirmation.confirmed_by,
        confirmation.qr_token,
        confirmation.photo_url,
        confirmation.note
      ]
    );
    return new DeliveryConfirmation(rows[0]);
  }
}

module.exports = DeliveryConfirmationRepository;
