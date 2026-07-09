export interface PostCreatedEvent { postId: string; groupId: string; authorId: string; }
export interface RatingCreatedEvent { ratingId: string; raterId: string; targetType: 'user' | 'group'; targetId: string; score: number; }
export interface ReportCreatedEvent { reportId: string; reporterId: string; targetType: string; targetId: string; }
