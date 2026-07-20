const ApiResponse = require('../Responses/ApiResponse');
const CreateRequestDTO = require('../../Application/DTOs/CreateRequestDTO');
const ApproveRequestDTO = require('../../Application/DTOs/ApproveRequestDTO');
const RejectRequestDTO = require('../../Application/DTOs/RejectRequestDTO');
const ScheduleRequestDTO = require('../../Application/DTOs/ScheduleRequestDTO');
const CompleteRequestDTO = require('../../Application/DTOs/CompleteRequestDTO');

class RequestController {
  constructor({ requestUseCases }) {
    this.requestUseCases = requestUseCases;
  }

  _auth(req) {
    const userId = (req.user && (req.user.sub || req.user.id)) || null;
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;
    return { userId, token };
  }

  async getRequests(req, res) {
    try {
      const result = await this.requestUseCases.getRequests(req.query);
      return ApiResponse.success(res, result.data, 200, result.meta);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err, err.statusCode || 500);
    }
  }

  async createRequest(req, res) {
    try {
      const auth = this._auth(req);
      const dto = new CreateRequestDTO({
        ...req.body,
        receiver_id: req.body.receiver_id || auth.userId,
      });
      dto.validate();
      const request = await this.requestUseCases.createRequest(dto, auth);
      return ApiResponse.success(res, request, 201);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err);
    }
  }

  async approveRequest(req, res) {
    try {
      const auth = this._auth(req);
      const reviewerId = (req.body && req.body.reviewed_by) || auth.userId;
      if (!reviewerId) throw new Error('reviewed_by is required');
      const request = await this.requestUseCases.approveRequest(req.params.id, reviewerId, auth);
      return ApiResponse.success(res, request);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err);
    }
  }

  async rejectRequest(req, res) {
    try {
      const auth = this._auth(req);
      const dto = new RejectRequestDTO({
        ...req.body,
        reviewed_by: (req.body && req.body.reviewed_by) || auth.userId,
      });
      dto.validate();
      const request = await this.requestUseCases.rejectRequest(
        req.params.id,
        dto.reviewed_by,
        dto.reason,
        auth
      );
      return ApiResponse.success(res, request);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err);
    }
  }

  async scheduleRequest(req, res) {
    try {
      const auth = this._auth(req);
      const dto = new ScheduleRequestDTO({
        ...req.body,
        reviewed_by: (req.body && req.body.reviewed_by) || auth.userId,
      });
      dto.validate();
      const request = await this.requestUseCases.scheduleRequest(
        req.params.id,
        dto.reviewed_by,
        dto.scheduled_at,
        auth
      );
      return ApiResponse.success(res, request);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err);
    }
  }

  async completeRequest(req, res) {
    try {
      const auth = this._auth(req);
      const dto = new CompleteRequestDTO({
        ...req.body,
        confirmed_by: (req.body && req.body.confirmed_by) || auth.userId,
      });
      dto.validate();
      const request = await this.requestUseCases.completeRequest(req.params.id, dto, auth);
      return ApiResponse.success(res, request);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err);
    }
  }

  async cancelRequest(req, res) {
    try {
      const auth = this._auth(req);
      const request = await this.requestUseCases.cancelRequest(req.params.id, auth);
      return ApiResponse.success(res, request);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err);
    }
  }

  async noShowRequest(req, res) {
    try {
      const auth = this._auth(req);
      const reviewerId = (req.body && req.body.reviewed_by) || auth.userId;
      if (!reviewerId) throw new Error('reviewed_by is required');
      const request = await this.requestUseCases.noShowRequest(req.params.id, reviewerId, auth);
      return ApiResponse.success(res, request);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err);
    }
  }

  async getDeliveryConfirmation(req, res) {
    try {
      const confirmation = await this.requestUseCases.getDeliveryConfirmation(req.params.id);
      if (!confirmation) {
        return ApiResponse.error(res, new Error('Delivery confirmation not found'), 404);
      }
      return ApiResponse.success(res, confirmation);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err);
    }
  }
}

module.exports = RequestController;
