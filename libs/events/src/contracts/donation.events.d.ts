export interface DonationCreatedEvent {
    donationId: string;
    donorId: string;
    groupId: string;
    code: string;
    /** Moderators / owners to notify (filled by publisher when known). */
    notifyUserIds?: string[];
}
export interface DonationReviewedEvent {
    donationId: string;
    donorId: string;
    groupId: string;
    action: 'accepted' | 'rejected';
    reason?: string;
}
export interface DonationScheduledEvent {
    donationId: string;
    donorId: string;
    groupId: string;
    scheduledAt: string;
    notifyUserIds?: string[];
}
export interface DonationCompletedEvent {
    donationId: string;
    donorId: string;
    groupId: string;
    acceptedItems: number;
    rejectedItems: number;
}
