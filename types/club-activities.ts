import { Timestamp } from 'firebase/firestore';

export type ActivityType = 'training' | 'competition' | 'meeting' | 'social' | 'youth_training';

export interface ClubActivity {
    id: string;
    clubId: string;
    name: string;
    description?: string;
    type: ActivityType;
    date: Date | Timestamp;
    startTime: string; // e.g., "18:00"
    endTime?: string;
    location: string;
    locationCoordinates?: {
        lat: number;
        lng: number;
    };
    organizerId: string;
    organizerName: string;
    visibility: 'club_only' | 'public';
    registrationRequired: boolean;
    registrationDeadline?: Date | Timestamp;

    // LOK-stöd specific
    isLokEligible: boolean;
    ageGroups?: string[]; // e.g., ["7-12", "13-20"]

    createdAt: Date | Timestamp;
    updatedAt: Date | Timestamp;
}

export type RegistrationStatus = 'registered' | 'attended' | 'cancelled' | 'no-show';

export interface ActivityRegistration {
    id: string;
    activityId: string;
    clubId: string;
    userId: string;
    userName: string;
    userBirthDate?: Date | Timestamp; // Needed for LOK-stöd
    status: RegistrationStatus;
    registeredAt: Date | Timestamp;
    markedAt?: Date | Timestamp;
    markedBy?: string; // Admin userId
}

export interface LokStodReport {
    clubId: string;
    period: string; // e.g., "2024-H1"
    totalActivities: number;
    totalParticipations: number;
    eligibleParticipations: number; // Based on age
    youthParticipations: number; // 7-20 years
    generatedAt: Date | Timestamp;
}
