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

                const totalCapacity = (user.ConsumedCapacity?.CapacityUnits || 0) +
                    (orders.ConsumedCapacity?.CapacityUnits || 0) +
                    orderItemsCapacity;

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


    async getUsersByStatus(status: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // Not Ideal: main table's PK is userId, so we need a GSI to query by status
                // This means maintaining an extra index just for one access pattern
                const command = new QueryCommand({
                    TableName: this.usersTableName,
                    IndexName: 'UsersByStatusIndex',
                    KeyConditionExpression: 'status = :status',
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


    async getUsersByEmail(email: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // since we don't have a GSI for email, we need to scan the table
                const command = new ScanCommand({
                    TableName: this.usersTableName,
                    FilterExpression: 'email = :email',
                    ExpressionAttributeValues: { ':email': email },
                    ReturnConsumedCapacity: "TOTAL"
                });

                const result = await this.client.send(command);
                return result;
            },
            'GetUsersByEmail',
            'Relational',
            1
        );
    }

    async getUserOrders(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {

                // forced to use a GSI for this access pattern
                const command = new QueryCommand({
                    TableName: this.ordersTableName,
                    IndexName: 'OrdersByUserIdIndex',
                    KeyConditionExpression: 'userId = :userId',
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

    // How many order items are being bought from a specific supplier? 
    async getAllOrdersByDateRange(startDate: string, endDate: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // since it doesn't use sharding - this is just for comparison
                const command = new ScanCommand({
                    TableName: this.ordersTableName,
                    FilterExpression: '#createdAt BETWEEN :startDate AND :endDate',
                    ExpressionAttributeNames: { '#createdAt': 'createdAt' },
                    ExpressionAttributeValues: {
                        ':startDate': startDate,
                        ':endDate': endDate
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetAllOrdersByDateRange',
            'Relational',
            1
        );
    }

    async getOrderItemsBySupplierId(supplierId: string, startDate: string, endDate: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // BAD: Scan operation with filter because no efficient access pattern
                // Note: Relational design doesn't use sharding, so shardId parameter is ignored
                // This demonstrates the inefficiency of relational design for this access pattern
                const command = new ScanCommand({
                    TableName: this.orderItemsTableName,
                    FilterExpression: '#supplierId = :supplierId AND #createdAt BETWEEN :startDate AND :endDate',
                    ExpressionAttributeNames: { '#createdAt': 'createdAt' },
                    ExpressionAttributeValues: {
                        ':supplierId': supplierId,
                        ':startDate': startDate,
                        ':endDate': endDate
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetOrderItemsBySupplierId_ScanRequired',
            'Relational',
            1
        );
    }

    async batchCreateItems(items: any[]): Promise<TestResult> {
        return this.batchWriteWithChunking(items, this.usersTableName, 'BatchCreateItems');
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

} 