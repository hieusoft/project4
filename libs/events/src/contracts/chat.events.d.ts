export interface MessageSentEvent {
    messageId: string;
    conversationId: string;
    senderId: string;
    senderSide: 'user' | 'group';
    /** Participants to push if offline (excluding sender). */
    recipientUserIds?: string[];
    preview?: string;
}
