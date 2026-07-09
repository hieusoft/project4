export interface ListingCreatedEvent { listingId: string; inventoryItemId: string; groupId: string; }
export interface RequestApprovedEvent { requestId: string; listingId: string; receiverId: string; groupId: string; }
export interface RequestCompletedEvent { requestId: string; listingId: string; receiverId: string; donorId?: string; }
