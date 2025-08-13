// Relational Design Types
export interface RelationalUser {
    PK: string; // userId
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

// Single Table Design Types
export interface SingleTableUser {
    PK: string; // USER#<userId>
    SK: string; // USER#<userId>
    entityType: 'USER';
    id: string;
    username: string;
    email: string;
    createdAt: string;
}

export interface SingleTablePost {
    PK: string; // USER#<userId>
    SK: string; // POST#<postId>#<date>
    entityType: 'POST';
    id: string;
    userId: string;
    content: string;
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
    success: boolean;
    error?: string;
}

// Data Generation Result Types
export interface RelationalTestData {
    users: RelationalUser[];
    posts: RelationalPost[];
}

export interface SingleTableTestData {
    users: SingleTableUser[];
    posts: SingleTablePost[];
}

export interface CompleteTestData {
    relational: RelationalTestData;
    singleTable: SingleTableTestData;
} 