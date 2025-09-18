// Entity Type Enum
export enum EntityType {
    USER = 'USER',
    POST = 'POST',
    COMMENT = 'COMMENT'
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
}

// Data Generation Result Types
export interface RelationalTestData {
    users: RelationalUser[];
    posts: RelationalPost[];
    comments: RelationalComment[];
}

export interface SingleTableTestData {
    users: SingleTableUser[];
    posts: SingleTablePost[];
    comments: SingleTableComment[];
}

export interface CompleteTestData {
    relational: RelationalTestData;
    singleTable: SingleTableTestData;
} 