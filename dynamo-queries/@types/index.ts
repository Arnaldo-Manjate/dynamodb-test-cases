// Entity Type Enum
export enum EntityType {
    USER = 'USER',
    POST = 'POST',
    COMMENT = 'COMMENT',
    FOLLOWER = 'FOLLOWER',
    LIKE = 'LIKE'
}

// Relational Design Types
export interface RelationalUser {
    userId: string; // userId
    id: string;
    email: string;
    username: string;
    createdAt: string;
}

export interface RelationalPost {
    postId: string; // postId (missing sort key - demonstrates Point 1)
    id: string;
    userId: string;
    content: string;
    createdAt: string;
}

export interface RelationalComment {
    commentId: string;
    id: string;
    userId: string;
    postId: string;
    postAuthorUserId: string; // For GSI: allows querying comments by post author
    content: string;
    createdAt: string;
}

export interface RelationalFollower {
    followId: string;
    id: string;
    followerId: string;
    followingId: string;
    createdAt: string;
}

export interface RelationalUserFollowing {
    followId: string;
    id: string;
    followerId: string;
    followingId: string;
    createdAt: string;
}

export interface RelationalLike {
    likeId: string;
    id: string;
    userId: string;
    postId: string;
    postAuthorUserId: string; // For GSI: allows querying likes by post author
    createdAt: string;
}

// Single Table Design Types
export interface SingleTableUser {
    PK: string; // USER#<userId>
    SK: string; // USER#<userId>
    entityType: EntityType.USER;
    id: string;
    username: string;
    email: string;
    createdAt: string;
}

export interface SingleTablePost {
    PK: string; // USER#<userId>
    SK: string; // #POSTS#<date>
    entityType: EntityType.POST;
    id: string;
    userId: string;
    content: string;
    createdAt: string;
    datePrefix: string;
}

export interface SingleTableComment {
    PK: string; // USER#<userId>
    SK: string; // #COMMENTS#<date>
    entityType: EntityType.COMMENT;
    id: string;
    userId: string;
    postId: string;
    content: string;
    createdAt: string;
    datePrefix: string;
    GSI1PK?: string; // USER_COMMENTS#<userId> - for getting all user comments
    GSI1SK?: string; // <createdAt> - for sorting comments by date
}

export interface SingleTableFollower {
    PK: string; // USER#<userId>
    SK: string; // #FOLLOWERS#<date>
    entityType: EntityType.FOLLOWER;
    id: string;
    followerId: string;
    followingId: string;
    createdAt: string;
    datePrefix: string;
}

export interface SingleTableLike {
    PK: string; // USER#<userId>
    SK: string; // #LIKES#<date>
    entityType: EntityType.LIKE;
    id: string;
    userId: string;
    postId: string;
    createdAt: string;
    datePrefix: string;
}

// Test Result Types
export interface TestResult {
    operation: string;
    design: 'Relational' | 'SingleTable';
    duration: number; // milliseconds
    consumedCapacity?: {
        readCapacityUnits?: number;
        writeCapacityUnits?: number;
    };
    itemCount: number; // Actual number of items returned/fetched from DynamoDB
    requestCount?: number; // Number of DynamoDB requests made
    success: boolean;
    error?: string;
    // For getUserScreenData results
    user?: any;
    posts?: any[];
    comments?: any[];
    followers?: any[];
    likes?: any[];
}

// Data Generation Result Types
export interface RelationalTestData {
    users: RelationalUser[];
    posts: RelationalPost[];
    comments: RelationalComment[];
    followers: RelationalFollower[];
    userFollowings: RelationalUserFollowing[];
    likes: RelationalLike[];
}

export interface SingleTableTestData {
    users: SingleTableUser[];
    posts: SingleTablePost[];
    comments: SingleTableComment[];
    followers: SingleTableFollower[];
    likes: SingleTableLike[];
}

export interface CompleteTestData {
    relational: RelationalTestData;
    singleTable: SingleTableTestData;
} 