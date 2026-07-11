class IEventPublisher {
  publishListingCreated(payload) { throw new Error("Method not implemented."); }
  publishRequestCreated(payload) { throw new Error("Method not implemented."); }
  publishRequestApproved(payload) { throw new Error("Method not implemented."); }
  publishRequestRejected(payload) { throw new Error("Method not implemented."); }
  publishRequestScheduled(payload) { throw new Error("Method not implemented."); }
  publishRequestCompleted(payload) { throw new Error("Method not implemented."); }
}
module.exports = IEventPublisher;
