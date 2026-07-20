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

  async getRequests(req, res) {
    try {
      const result = await this.requestUseCases.getRequests(req.query);
      return ApiResponse.success(res, result.data, 200, result.meta);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err, 500);
    }
  }

  async createRequest(req, res) {
    try {
      const dto = new CreateRequestDTO(req.body);
      dto.validate();
      
      const request = await this.requestUseCases.createRequest(dto);
      return ApiResponse.success(res, request, 201);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err);
    }
  }

  async approveRequest(req, res) {
    try {
      const { id } = req.params;
      const dto = new ApproveRequestDTO(req.body);
      dto.validate();

      const request = await this.requestUseCases.approveRequest(id, dto.reviewed_by);
      return ApiResponse.success(res, request);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err);
    }
  }

  async rejectRequest(req, res) {
    try {
      const { id } = req.params;
      const dto = new RejectRequestDTO(req.body);
      dto.validate();

      const request = await this.requestUseCases.rejectRequest(id, dto.reviewed_by, dto.reason);
      return ApiResponse.success(res, request);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err);
    }
  }

  async scheduleRequest(req, res) {
    try {
      const { id } = req.params;
      const dto = new ScheduleRequestDTO(req.body);
      dto.validate();

      const request = await this.requestUseCases.scheduleRequest(id, dto.reviewed_by, dto.scheduled_at);
      return ApiResponse.success(res, request);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err);
    }
  }

  async completeRequest(req, res) {
    try {
      const { id } = req.params;
      const dto = new CompleteRequestDTO(req.body);
      dto.validate();

      const request = await this.requestUseCases.completeRequest(id, dto);
      return ApiResponse.success(res, request);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err);
    }
  }

  async getDeliveryConfirmation(req, res) {
    try {
      const { id } = req.params;
      const confirmation = await this.requestUseCases.getDeliveryConfirmation(id);
      if (!confirmation) {
        return ApiResponse.error(res, new Error('Delivery confirmation not found'), 404);
      }
      return ApiResponse.success(res, confirmation);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err);
    }
  }

  async cancelRequest(req, res) {
    try {
      const { id } = req.params;
      const { user_id } = req.body; // or req.user.id if auth middleware is present
      const request = await this.requestUseCases.cancelRequest(id, user_id);
      return ApiResponse.success(res, request);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err);
    }
  }

  async noShowRequest(req, res) {
    try {
      const { id } = req.params;
      const { reviewer_id } = req.body;
      const request = await this.requestUseCases.noShowRequest(id, reviewer_id);
      return ApiResponse.success(res, request);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err);
    }
  }
}

module.exports = RequestController;
