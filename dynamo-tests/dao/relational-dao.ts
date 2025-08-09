import { BaseDAO } from './base-dao';
import { User, Order, TestResult } from '../types';
import { PutCommand, GetCommand, QueryCommand, BatchWriteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';

export class RelationalDAO extends BaseDAO {
    private usersTableName: string;
    private ordersTableName: string;

    constructor(usersTableName: string, ordersTableName: string, region: string = 'us-east-1') {
        super(usersTableName, region); // Use users table as primary
        this.usersTableName = usersTableName;
        this.ordersTableName = ordersTableName;
    }

    protected getDesignType(): 'Relational' {
        return 'Relational';
    }

    // User operations
    async getUser(userId: string): Promise<TestResult> {
        return this.getItem({ userId });
    }

    async createUser(user: User): Promise<TestResult> {
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
            'GetItem',
            1,
            false
        );
    }

    // Order operations
    async getOrder(userId: string, orderId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                const command = new GetCommand({
                    TableName: this.ordersTableName,
                    Key: { userId, orderId },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetOrder',
            'Relational',
            'GetItem',
            1,
            false
        );
    }

    async getAllOrders(): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                const command = new ScanCommand({
                    TableName: this.ordersTableName,
                    Select: 'ALL_ATTRIBUTES',
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetAllOrders',
            'Relational',
            'Query',
            1,
            false
        );
    }

    async createOrder(order: Order): Promise<TestResult> {
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
            'GetItem',
            1,
            false
        );
    }

    // Query operations - now efficient with userId as partition key
    async getUserOrders(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                const command = new QueryCommand({
                    TableName: this.ordersTableName,
                    KeyConditionExpression: 'userId = :userId',
                    ExpressionAttributeValues: {
                        ':userId': userId
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetUserOrders',
            'Relational',
            'Query',
            1,
            false
        );
    }

    // Get user orders using GSI (OrderIdIndex) - query by userId
    async getUserOrdersWithGSI(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                const command = new QueryCommand({
                    TableName: this.ordersTableName,
                    IndexName: 'OrderIdIndex',
                    KeyConditionExpression: 'userId = :userId',
                    ExpressionAttributeValues: {
                        ':userId': userId
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetUserOrdersWithGSI',
            'Relational',
            'Query',
            1,
            true,
            'OrderIdIndex'
        );
    }

    // Inefficient query: Get user orders by querying each order individually
    // This demonstrates the performance impact of relational design
    async getUserOrdersWithoutGSI(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // This is inefficient because we need to know the orderIds first
                // In a real scenario, you'd have to get orderIds from somewhere else
                // or maintain a separate list of user's orders

                // For demonstration, we'll simulate getting orderIds for a user
                // In reality, this would require additional queries or data structures
                const mockOrderIds = [
                    `ORDER#${userId}#001`,
                    `ORDER#${userId}#002`,
                    `ORDER#${userId}#003`
                ];

                const results = [];

                // Query each order individually - this is the inefficiency
                for (const orderId of mockOrderIds) {
                    const command = new GetCommand({
                        TableName: this.ordersTableName,
                        Key: {
                            userId: userId,
                            orderId: orderId
                        }
                    });
                    results.push(await this.client.send(command));
                }

                return results;
            },
            'GetUserOrdersWithoutGSI',
            'Relational',
            'GetItem',
            3,
            false
        );
    }

    // Batch operations
    async batchCreateUsers(users: User[]): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // Split users into batches of 25 (DynamoDB limit)
                const batches = this.chunkArray(users, 25);
                const results = [];
                const totalBatches = batches.length;

                console.info(`  Processing ${users.length} users in ${totalBatches} batches...`);

                for (let i = 0; i < batches.length; i++) {
                    const batch = batches[i];
                    const writeRequests = batch.map(user => ({
                        PutRequest: {
                            Item: user
                        }
                    }));

                    const command = new BatchWriteCommand({
                        RequestItems: {
                            [this.usersTableName]: writeRequests
                        },
                        ReturnConsumedCapacity: "TOTAL"
                    });

                    results.push(await this.client.send(command));

                    // Show progress for every 1% increase
                    const currentProgress = Math.floor(((i + 1) / totalBatches) * 100);
                    const previousProgress = Math.floor((i / totalBatches) * 100);

                    if (currentProgress > previousProgress) {
                        console.info(`  Users batch progress: ${currentProgress}% (${i + 1}/${totalBatches} batches)`);
                    }
                }

                return results;
            },
            'BatchCreateUsers',
            'Relational',
            'BatchWrite',
            users.length,
            false
        );
    }

    async batchCreateOrders(orders: Order[]): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // Split orders into batches of 25 (DynamoDB limit)
                const batches = this.chunkArray(orders, 25);
                const results = [];
                const totalBatches = batches.length;

                console.info(`  Processing ${orders.length} orders in ${totalBatches} batches...`);

                for (let i = 0; i < batches.length; i++) {
                    const batch = batches[i];
                    const writeRequests = batch.map(order => ({
                        PutRequest: {
                            Item: order
                        }
                    }));

                    const command = new BatchWriteCommand({
                        RequestItems: {
                            [this.ordersTableName]: writeRequests
                        },
                        ReturnConsumedCapacity: "TOTAL"
                    });

                    results.push(await this.client.send(command));

                    // Show progress for every 1% increase
                    const currentProgress = Math.floor(((i + 1) / totalBatches) * 100);
                    const previousProgress = Math.floor((i / totalBatches) * 100);

                    if (currentProgress > previousProgress) {
                        console.info(`  Orders batch progress: ${currentProgress}% (${i + 1}/${totalBatches} batches)`);
                    }
                }

                return results;
            },
            'BatchCreateOrders',
            'Relational',
            'BatchWrite',
            orders.length,
            false
        );
    }

    // Complex query: Get user with their orders (requires multiple queries)
    async getUserWithOrders(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // First query: Get user
                const userCommand = new GetCommand({
                    TableName: this.usersTableName,
                    Key: { userId },
                    ReturnConsumedCapacity: "TOTAL"
                });
                const user = await this.client.send(userCommand);

                // Second query: Get user's orders (now efficient with userId as PK)
                const ordersCommand = new QueryCommand({
                    TableName: this.ordersTableName,
                    KeyConditionExpression: 'userId = :userId',
                    ExpressionAttributeValues: {
                        ':userId': userId
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                const orders = await this.client.send(ordersCommand);

                return { user, orders };
            },
            'GetUserWithOrders',
            'Relational',
            'Query',
            2, // 2 queries
            false
        );
    }

    // Table metrics methods
    // Note: ItemCount is only updated approximately every 6 hours
    // Reference: https://aws.amazon.com/blogs/database/obtaining-item-counts-in-amazon-dynamodb/
    async getOrdersTableItemCount(): Promise<number> {
        try {
            const command = new DescribeTableCommand({
                TableName: this.ordersTableName
            });

            const response = await this.dynamoClient.send(command);
            return response.Table?.ItemCount || 0;
        } catch (error) {
            console.error(`Error getting item count for orders table ${this.ordersTableName}:`, error);
            return 0;
        }
    }

    async logOrdersTableItemCount(): Promise<void> {
        const count = await this.getOrdersTableItemCount();
        console.info(`  Table ${this.ordersTableName}: ${count.toLocaleString()} items`);
    }
} 