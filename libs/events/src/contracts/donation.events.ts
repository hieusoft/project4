export interface DonationCreatedEvent { donationId: string; donorId: string; groupId: string; code: string; }
export interface DonationCompletedEvent { donationId: string; donorId: string; groupId: string; acceptedItems: number; rejectedItems: number; }
