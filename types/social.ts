/**
 * Social Features - Comments, Chat, Q&A
 */

export interface Comment {
    id: string;
    resourceType: 'event' | 'training' | 'track';
    resourceId: string;
    userId: string;
    userName: string;
    userPhoto?: string;
    text: string;
    createdAt: Date;
    updatedAt?: Date;
    likes: string[]; // User IDs
    replies: Comment[];
    isQuestion: boolean; // For Q&A feature
    isAnswered: boolean;
}

export interface ChatMessage {
    id: string;
    roomId: string; // e.g., "event-123" or "team-456"
    userId: string;
    userName: string;
    userPhoto?: string;
    text: string;
    timestamp: Date;
    type: 'message' | 'system' | 'announcement';
}

export interface ChatRoom {
    id: string;
    type: 'event' | 'team' | 'club';
    resourceId: string;
    name: string;
    participants: string[]; // User IDs
    lastMessage?: ChatMessage;
    createdAt: Date;
}

// Training signup (allows visitors without login)
export interface TrainingSignup {
    id: string;
    trainingId: string;

    // Either userId OR guest info
    userId?: string;
    guestName?: string;
    guestEmail?: string;
    guestPhone?: string;

    signupTime: Date;
    attending: boolean;
    comment?: string;
}

// Event registration
export interface EventRegistration {
    id: string;
    eventId: string;
    userId: string;
    classId: string;
    startNumber?: number;
    siCard?: string;
    registeredAt: Date;
    status: 'pending' | 'confirmed' | 'cancelled';
    paidAt?: Date;
}

// Club membership request
export interface ClubMembershipRequest {
    id: string;
    clubId: string;
    userId: string;
    message?: string;
    requestedAt: Date;
    status: 'pending' | 'approved' | 'rejected' | 'blocked';
    processedBy?: string;
    processedAt?: Date;
    rejectionReason?: string;
}
