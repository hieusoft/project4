export interface GroupCreatedEvent {
    groupId: string;
    ownerId: string;
    name?: string;
}
export interface GroupApprovedEvent {
    groupId: string;
    ownerId: string;
    name?: string;
}
export interface GroupJoinRequestedEvent {
    groupId: string;
    userId: string;
    notifyUserIds?: string[];
}
export interface GroupMemberApprovedEvent {
    groupId: string;
    userId: string;
}
export interface PostCreatedEvent {
    postId: string;
    groupId: string;
    authorId: string;
    notifyUserIds?: string[];
}
export interface RatingCreatedEvent {
    ratingId: string;
    raterId: string;
    targetType: 'user' | 'group';
    targetId: string;
    score: number;
}
export interface ReportCreatedEvent {
    reportId: string;
    reporterId: string;
    targetType: string;
    targetId: string;
}
