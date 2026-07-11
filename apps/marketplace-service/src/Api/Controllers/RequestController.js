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

  async getRequestsUseCase(req, res) {
    try {
      const requests = await this.requestUseCases.getRequests(req.query);
      return ApiResponse.success(res, requests);
    } catch (err) {
      console.error(err);
      return ApiResponse.error(res, err, 500);
    }
  }

  async createRequestUseCase(req, res) {
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

  async approveRequestUseCase(req, res) {
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

  async rejectRequestUseCase(req, res) {
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

  async scheduleRequestUseCase(req, res) {
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

  async completeRequestUseCase(req, res) {
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
}

module.exports = RequestController;
