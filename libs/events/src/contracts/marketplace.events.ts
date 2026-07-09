export interface ListingCreatedEvent {
  listingId: string;
  inventoryItemId: string;
  groupId: string;
  notifyUserIds?: string[];
}

export interface RequestCreatedEvent {
  requestId: string;
  listingId: string;
  receiverId: string;
  groupId: string;
  notifyUserIds?: string[];
}

export interface RequestApprovedEvent {
  requestId: string;
  listingId: string;
  receiverId: string;
  groupId: string;
}

export interface RequestScheduledEvent {
  requestId: string;
  listingId: string;
  receiverId: string;
  groupId: string;
  scheduledAt: string;
  notifyUserIds?: string[];
}

export interface RequestCompletedEvent {
  requestId: string;
  listingId: string;
  receiverId: string;
  donorId?: string;
  notifyUserIds?: string[];
}
