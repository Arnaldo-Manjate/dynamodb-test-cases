import { BaseDAO } from './base-dao';
import { TestResult } from '../@types';
import { QueryCommand, GetCommand, ScanCommand, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

/**
 * Relational Design DAO - Demonstrates Anti-patterns
 * 
 * DESIGN PHILOSOPHY: Traditional relational thinking applied to DynamoDB
 * 
 * This implementation shows the problems with relational design in DynamoDB:
 * - Multiple tables require multiple network requests for related data
 * - Missing sort keys force GSI creation for basic queries
 * - Poor access patterns lead to scan operations and high RCU consumption
 * - No efficient way to retrieve all user data in one operation
 * 
 * Key Problems:
 * - Need 4+ separate requests to get complete user data
 * - Forced GSI usage due to poor schema design
 * - Higher latency and RCU consumption
 * - Complex index management
 */
export class RelationalDAO extends BaseDAO {
    private usersTableName: string;
    private ordersTableName: string;
    private orderItemsTableName: string;

    constructor(usersTableName: string, ordersTableName: string, orderItemsTableName: string, region: string = 'us-east-1') {
        super(region);
        this.usersTableName = usersTableName;
        this.ordersTableName = ordersTableName;
        this.orderItemsTableName = orderItemsTableName;
    }

    protected getDesignType(): 'Relational' {
        return 'Relational';
    }

    // Getter methods for table names and client access
    get getUsersTableName(): string { return this.usersTableName; }
    get getOrdersTableName(): string { return this.ordersTableName; }
    get getOrderItemsTableName(): string { return this.orderItemsTableName; }
    get getClient() { return this.client; }

    async getUsersByStatus(status: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // BAD: Main table's PK is orderId, so we need a GSI to query by userId
                // This means maintaining an extra index just for this access pattern

                // BAD: Have to scan because we can't query by non-key attribute
                const command = new ScanCommand({
                    TableName: this.usersTableName,
                    FilterExpression: 'status = :status',
                    ExpressionAttributeValues: { ':status': status },
                    ReturnConsumedCapacity: "TOTAL"
                });

                const result = await this.client.send(command);
                return result;
            },
            'GetUsersByStatus',
            'Relational',
            1
        );
    }

    // Point 1: Missing Sort Keys - Bad Pattern
    // This forces GSI creation for date-based queries
    async getUserOrders(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // BAD: Main table's PK is orderId, so we need a GSI to query by userId
                // This means maintaining an extra index just for this access pattern

                // BAD: Have to scan because we can't query by non-key attribute
                const command = new ScanCommand({
                    TableName: this.ordersTableName,
                    FilterExpression: 'userId = :userId',
                    ExpressionAttributeValues: { ':userId': userId },
                    ReturnConsumedCapacity: "TOTAL"
                });

                const result = await this.client.send(command);
                return result;
            },
            'GetUserOrders_NoSortKey',
            'Relational',
            1
        );
    }

    // Point 2: Specific Naming - Bad Pattern
    // Using descriptive names instead of generic PK/SK
    async getUserById(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // BAD: Using specific field names instead of generic PK/SK
                const command = new GetCommand({
                    TableName: this.usersTableName,
                    Key: { userId: userId }, // Should be generic PK/SK
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetUser_SpecificNaming',
            'Relational',
            1
        );
    }

    // Point 3: GSI Necessity Due to Poor Schema - Bad Pattern
    // Need GSI because we're missing sort keys
    async getOrdersByDateRange(userId: string, startDate: string, endDate: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // BAD: Forced to use GSI because no sort key on main table
                // The GSI has userId as PK and createdAt as SK, but main table has orderId as PK
                const command = new QueryCommand({
                    TableName: this.ordersTableName,
                    IndexName: 'OrdersByDateIndex', // Forced GSI usage
                    KeyConditionExpression: 'userId = :userId AND #createdAt BETWEEN :startDate AND :endDate',
                    ExpressionAttributeNames: { '#createdAt': 'createdAt' },
                    ExpressionAttributeValues: {
                        ':userId': userId,
                        ':startDate': startDate,
                        ':endDate': endDate
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetOrdersByDateRange_GSIRequired',
            'Relational',
            1
        );
    }

    // Point 4: GSI Naming Anti-patterns - Bad Pattern
    // Using descriptive names instead of generic names
    async getUserOrdersWithGSI(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // BAD: Descriptive GSI name instead of generic
                // BAD: Forced to use GSI because main table schema is poor
                const command = new QueryCommand({
                    TableName: this.ordersTableName,
                    IndexName: 'OrdersByDateIndex', // Should be GSI1, GSI2, etc.
                    KeyConditionExpression: 'userId = :userId',
                    ExpressionAttributeValues: { ':userId': userId },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetUserOrders_DescriptiveGSI',
            'Relational',
            1
        );
    }



    // Inefficient Access Patterns - Bad Pattern
    // Scan operation due to poor schema design
    async getAllOrders(): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // BAD: Scan operation because no efficient access pattern
                const command = new ScanCommand({
                    TableName: this.ordersTableName,
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetAllOrders_ScanRequired',
            'Relational',
            1
        );
    }



    // ========================================
    // POINTS 3 & 4 MERGED: MULTIPLE REQUESTS VS SINGLE QUERY
    // Demonstrates: How relational design requires multiple network requests
    // for the same data that single table design can get in one query
    // ========================================

    // Point 3 & 4: Multiple Network Requests - Bad Pattern
    // Need 4 separate requests to get the same data that single table gets in 1
    // This demonstrates the inefficiency of relational design for frequently accessed data
    async getUserScreenData(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                let requestCount = 0;
                // Multiple network requests required for relational design
                // 1. Get user
                const userCommand = new GetCommand({
                    TableName: this.usersTableName,
                    Key: { userId: userId },
                    ReturnConsumedCapacity: "TOTAL"
                });
                const user = await this.client.send(userCommand);
                requestCount++;
                // 2. Get user orders (requires GSI since main table has orderId as PK)
                const ordersCommand = new QueryCommand({
                    TableName: this.ordersTableName,
                    IndexName: 'OrdersByUserIdIndex',
                    KeyConditionExpression: 'userId = :userId',
                    ExpressionAttributeValues: { ':userId': userId },
                    ReturnConsumedCapacity: "TOTAL"
                });
                const orders = await this.client.send(ordersCommand);
                requestCount++;
                // 3. Get orderItems for user's orders using GSI (single query instead of N+1)
                const orderItemsCommand = new QueryCommand({
                    TableName: this.orderItemsTableName,
                    IndexName: 'OrderItemsByOrderCustomerIndex',
                    KeyConditionExpression: 'orderCustomerUserId = :userId',
                    ExpressionAttributeValues: { ':userId': userId },
                    ReturnConsumedCapacity: "TOTAL"
                });
                requestCount++;
                const orderItemsResult = await this.client.send(orderItemsCommand);
                const allOrderItems = orderItemsResult.Items || [];
                const orderItemsCapacity = orderItemsResult.ConsumedCapacity?.CapacityUnits || 0;

                // Return combined result with proper consumed capacity
                const totalCapacity = (user.ConsumedCapacity?.CapacityUnits || 0) +
                    (orders.ConsumedCapacity?.CapacityUnits || 0) +
                    orderItemsCapacity;

                // Request count is tracked by incrementRequestCount() in base DAO
                // Each call to client.send() increments the counter

                return {
                    user: user.Item,
                    orders: orders.Items,
                    orderItems: allOrderItems,
                    ConsumedCapacity: {
                        CapacityUnits: totalCapacity
                    },
                    Items: [
                        user.Item,
                        ...(orders.Items || []),
                        ...allOrderItems
                    ],
                    Count: 1 + (orders.Count || 0) + allOrderItems.length,
                    requestCount: requestCount
                };
            },
            'GetUserScreenData_MultipleRequests',
            'Relational',
            1
        );
    }

    // Data insertion methods
    async createUser(user: any): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                const command = new PutCommand({
                    TableName: this.usersTableName,
                    Item: user,
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'CreateUser',
            'Relational',
            1
        );
    }

    async createOrder(order: any): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                const command = new PutCommand({
                    TableName: this.ordersTableName,
                    Item: order,
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'CreateOrder',
            'Relational',
            1
        );
    }

    async batchCreateUsers(users: any[]): Promise<TestResult> {
        return this.batchWriteWithChunking(users, this.usersTableName, 'BatchCreateUsers');
    }

    async batchCreateOrders(orders: any[]): Promise<TestResult> {
        return this.batchWriteWithChunking(orders, this.ordersTableName, 'BatchCreateOrders');
    }

    async batchCreateOrderItems(orderItems: any[]): Promise<TestResult> {
        return this.batchWriteWithChunking(orderItems, this.orderItemsTableName, 'BatchCreateOrderItems');
    }


    // Point 6: Multiple Queries Required - Bad Pattern
    // Need to first get all orders by user, then query each order for orderItems
    async getAllUserOrderItems(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // BAD: Multiple network requests required
                // 1. First get all orders by the user
                const ordersCommand = new QueryCommand({
                    TableName: this.ordersTableName,
                    IndexName: 'OrdersByDateIndex',
                    KeyConditionExpression: 'userId = :userId',
                    ExpressionAttributeValues: { ':userId': userId },
                    ReturnConsumedCapacity: "TOTAL"
                });
                const orders = await this.client.send(ordersCommand);

                // 2. Then get orderItems for each order
                let allOrderItems: any[] = [];
                let totalCapacity = orders.ConsumedCapacity?.CapacityUnits || 0;

                if (orders.Items && orders.Items.length > 0) {
                    for (const order of orders.Items) {
                        const orderItemsCommand = new QueryCommand({
                            TableName: this.orderItemsTableName,
                            IndexName: 'OrderItemsByOrderCustomerIndex',
                            KeyConditionExpression: 'orderCustomerUserId = :orderCustomerUserId',
                            ExpressionAttributeValues: {
                                ':orderCustomerUserId': order.userId
                            },
                            ReturnConsumedCapacity: "TOTAL"
                        });
                        const orderOrderItems = await this.client.send(orderItemsCommand);
                        if (orderOrderItems.Items) {
                            allOrderItems.push(...orderOrderItems.Items);
                        }
                        totalCapacity += orderOrderItems.ConsumedCapacity?.CapacityUnits || 0;
                    }
                }

                return {
                    Items: allOrderItems,
                    Count: allOrderItems.length,
                    ConsumedCapacity: {
                        CapacityUnits: totalCapacity
                    }
                };
            },
            'GetAllUserOrderItems_MultipleQueries',
            'Relational',
            1
        );
    }
} 