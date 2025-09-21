// Entity Type Enum
export enum EntityType {
    USER = 'USER',
    ORDER = 'ORDER',
    ORDER_ITEM = 'ORDER_ITEM'
}

// Relational Design Types
export interface RelationalUser {
    id: string;
    email: string;
    username: string;
    status: string;
    pricingPlan: string;
    createdAt: string;
}

export interface RelationalOrder {
    orderId: string; // orderId (missing sort key - demonstrates Point 1)
    id: string;
    userId: string;
    orderNumber: string;
    totalAmount: number;
    status: string;
    createdAt: string;
}

export interface RelationalOrderItem {
    orderItemId: string;
    id: string;
    orderId: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    orderCustomerUserId: string; // For GSI: allows querying orderItems by order customer
    createdAt: string;
}


// Single Table Design Types
export interface SingleTableUser {
    PK: string; // USER#<userId>
    SK: string; // USER#<userId>
    id: string;
    username: string;
    status: string;
    pricingPlan: string;
    email: string;
    createdAt: string;
    entityType: EntityType.USER;
}

export interface SingleTableOrder {
    PK: string; // USER#<userId>
    SK: string; // #ORDER#<date>
    entityType: EntityType.ORDER;
    id: string;
    userId: string;
    orderNumber: string;
    totalAmount: number;
    status: string;
    createdAt: string;
    datePrefix: string;
}

export interface SingleTableOrderItem {
    PK: string; // USER#<userId>
    SK: string; // #ORDER_ITEM#<date>
    entityType: EntityType.ORDER_ITEM;
    id: string;
    orderId: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    createdAt: string;
    datePrefix: string;
    GSI1PK?: string; // USER_ORDER_ITEMS#<userId> - for getting all user order items
    GSI1SK?: string; // <createdAt> - for sorting order items by date
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
    orders?: any[];
    orderItems?: any[];
}

// Data Generation Result Types
export interface RelationalTestData {
    users: RelationalUser[];
    orders: RelationalOrder[];
    orderItems: RelationalOrderItem[];
}

export interface SingleTableTestData {
    users: SingleTableUser[];
    orders: SingleTableOrder[];
    orderItems: SingleTableOrderItem[];
}

export interface CompleteTestData {
    relational: RelationalTestData;
    singleTable: SingleTableTestData;
} 