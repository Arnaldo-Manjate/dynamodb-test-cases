export interface User {
    userId: string;
    email: string;
    name: string;
    createdAt: string;
    lastLoginAt: string;
}

export interface Order {
    orderId: string;
    userId: string;
    orderDate: string;
    totalAmount: number;
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    items: OrderItem[];
}

export interface OrderItem {
    itemId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
}

// Single Table Design Types
export interface SingleTableUser {
    PK: string; // USER#<userId>
    SK: string; // USER#<userId>
    entityType: 'USER';
    userId: string;
    email: string;
    name: string;
    createdAt: string;
    lastLoginAt: string;
}

export interface SingleTableOrder {
    PK: string; // USER#<userId>
    SK: string; // ORDER#<orderId>#<orderDate>
    entityType: 'ORDER';
    orderId: string;
    userId: string;
    orderDate: string;
    totalAmount: number;
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    items: OrderItem[];
}

export interface TestResult {
    testName: string;
    design: 'Relational' | 'SingleTable';
    operation: 'GetItem' | 'Query' | 'BatchWrite' | 'BatchGet';
    duration: number; // milliseconds
    consumedCapacity?: {
        readCapacityUnits?: number;
        writeCapacityUnits?: number;
        tableName?: string;
        indexName?: string;
    };
    itemCount: number;
    recordCount: number; // Number of records fetched/processed in this operation
    success: boolean;
    error?: string;
    // Enhanced metrics
    startTime: number; // timestamp
    endTime: number; // timestamp
    usedGSI: boolean;
    gsiName?: string;
    requestId?: string;
    // Detailed timing
    networkLatency?: number;
    processingTime?: number;
    // Cost tracking
    estimatedCost?: number; // in USD
    rcuConsumed?: number;
    wcuConsumed?: number;
}

export interface PerformanceMetrics {
    averageLatency: number;
    totalRCU: number;
    totalWCU: number;
    totalCost: number;
    operationCount: number;
}

export interface DetailedPerformanceMetrics extends PerformanceMetrics {
    fastestRequest: TestResult;
    slowestRequest: TestResult;
    gsiPerformance: {
        withGSI: {
            averageLatency: number;
            totalRCU: number;
            operationCount: number;
        };
        withoutGSI: {
            averageLatency: number;
            totalRCU: number;
            operationCount: number;
        };
        improvement: number; // percentage improvement with GSI
    };
    costBreakdown: {
        readCost: number;
        writeCost: number;
        storageCost: number;
        totalCost: number;
    };
    timingDistribution: {
        p50: number;
        p90: number;
        p95: number;
        p99: number;
    };
}

export interface CostAnalysis {
    design: 'Relational' | 'SingleTable';
    totalCost: number;
    costBreakdown: {
        readCost: number;
        writeCost: number;
        storageCost: number;
    };
    period: {
        start: string;
        end: string;
    };
}

export interface TestConfiguration {
    totalUsers: number;
    totalOrders: number;
    userOrderRatio: number;
    batchSize: number;
    testIterations: number;
} 