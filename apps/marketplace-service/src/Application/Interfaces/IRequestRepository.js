class IRequestRepository {
  async find(filters) { throw new Error("Method not implemented."); }
  async findById(id) { throw new Error("Method not implemented."); }
  async save(request) { throw new Error("Method not implemented."); }
  async update(request) { throw new Error("Method not implemented."); }
  async completeWithTransaction(request, listing, completionData) { throw new Error("Method not implemented."); }
}
module.exports = IRequestRepository;
