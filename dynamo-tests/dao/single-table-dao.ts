import { BaseDAO } from './base-dao';
import { SingleTableUser, SingleTableOrder, TestResult } from '../types';
import { PutCommand, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';

export class SingleTableDAO extends BaseDAO {
    constructor(tableName: string, region: string = 'us-east-1') {
        super(tableName, region);
    }

    protected getDesignType(): 'SingleTable' {
        return 'SingleTable';
    }

    // User operations
    async getUser(userId: string): Promise<TestResult> {
        return this.getItem({
            PK: `USER#${userId}`,
            SK: `USER#${userId}`
        });
    }

    async createUser(user: SingleTableUser): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                const command = new PutCommand({
                    TableName: this.tableName,
                    Item: user,
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'CreateUser',
            'SingleTable',
            'GetItem',
            1,
            false
        );
    }

    // Order operations
    async getOrder(userId: string, orderId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // For single table, we need to construct the SK to find the specific order
                const command = new QueryCommand({
                    TableName: this.tableName,
                    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                    ExpressionAttributeValues: {
                        ':pk': `USER#${userId}`,
                        ':sk': `ORDER#${orderId}`
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetOrder',
            'SingleTable',
            'Query',
            1,
            false
        );
    }

    async createOrder(order: SingleTableOrder): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                const command = new PutCommand({
                    TableName: this.tableName,
                    Item: order,
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'CreateOrder',
            'SingleTable',
            'GetItem',
            1,
            false
        );
    }

    // Efficient query: Get user with all their orders in one query
    async getUserWithOrders(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                const command = new QueryCommand({
                    TableName: this.tableName,
                    KeyConditionExpression: 'PK = :pk',
                    ExpressionAttributeValues: {
                        ':pk': `USER#${userId}`
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetUserWithOrders',
            'SingleTable',
            'Query',
            1,
            false
        );
    }

    // Query by entity type using GSI
    async getAllUsers(): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                const command = new QueryCommand({
                    TableName: this.tableName,
                    IndexName: 'EntityTypeIndex',
                    KeyConditionExpression: 'entityType = :entityType',
                    ExpressionAttributeValues: {
                        ':entityType': 'USER'
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetAllUsers',
            'SingleTable',
            'Query',
            1,
            true,
            'EntityTypeIndex'
        );
    }

    async getAllOrders(): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // Query using the main table with proper PK/SK pattern
                // We'll query for a specific user's orders as an example
                // In a real scenario, you'd need to know the userId or use a different pattern
                const command = new QueryCommand({
                    TableName: this.tableName,
                    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                    ExpressionAttributeValues: {
                        ':pk': 'USER#user-00001',
                        ':sk': 'ORDER#'
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetAllOrders',
            'SingleTable',
            'Query',
            1,
            false
        );
    }

    // Get specific user's orders
    async getUserOrders(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                const command = new QueryCommand({
                    TableName: this.tableName,
                    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                    ExpressionAttributeValues: {
                        ':pk': `USER#${userId}`,
                        ':sk': 'ORDER#'
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetUserOrders',
            'SingleTable',
            'Query',
            1,
            false
        );
    }

    // Get user orders using GSI (alternative approach)
    async getUserOrdersWithGSI(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                const command = new QueryCommand({
                    TableName: this.tableName,
                    IndexName: 'EntityTypeIndex',
                    KeyConditionExpression: 'entityType = :entityType',
                    FilterExpression: 'userId = :userId',
                    ExpressionAttributeValues: {
                        ':entityType': 'ORDER',
                        ':userId': userId
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetUserOrdersWithGSI',
            'SingleTable',
            'Query',
            1,
            true,
            'EntityTypeIndex'
        );
    }

    // Batch operations for single table
    async batchCreateItems(items: (SingleTableUser | SingleTableOrder)[]): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // Split items into batches of 25 (DynamoDB limit)
                const batches = this.chunkArray(items, 25);
                const results = [];
                const totalBatches = batches.length;

                console.info(`  Processing ${items.length} items in ${totalBatches} batches...`);

                for (let i = 0; i < batches.length; i++) {
                    const batch = batches[i];
                    const writeRequests = batch.map(item => ({
                        PutRequest: {
                            Item: item
                        }
                    }));

                    const command = new BatchWriteCommand({
                        RequestItems: {
                            [this.tableName]: writeRequests
                        },
                        ReturnConsumedCapacity: "TOTAL"
                    });

                    results.push(await this.client.send(command));

                    // Show progress for every 1% increase
                    const currentProgress = Math.floor(((i + 1) / totalBatches) * 100);
                    const previousProgress = Math.floor((i / totalBatches) * 100);

                    if (currentProgress > previousProgress) {
                        console.info(`  Single table batch progress: ${currentProgress}% (${i + 1}/${totalBatches} batches)`);
                    }
                }

                return results;
            },
            'BatchCreateItems',
            'SingleTable',
            'BatchWrite',
            items.length,
            false
        );
    }

    // Get specific order by orderId (requires scan or different access pattern)
    async getOrderById(orderId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                const command = new QueryCommand({
                    TableName: this.tableName,
                    IndexName: 'EntityTypeIndex',
                    KeyConditionExpression: 'entityType = :entityType',
                    FilterExpression: 'orderId = :orderId',
                    ExpressionAttributeValues: {
                        ':entityType': 'ORDER',
                        ':orderId': orderId
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetOrderById',
            'SingleTable',
            'Query',
            1,
            true,
            'EntityTypeIndex'
        );
    }

    // Get orders by status
    async getOrdersByStatus(status: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                const command = new QueryCommand({
                    TableName: this.tableName,
                    IndexName: 'EntityTypeIndex',
                    KeyConditionExpression: 'entityType = :entityType',
                    FilterExpression: '#status = :status',
                    ExpressionAttributeNames: {
                        '#status': 'status'
                    },
                    ExpressionAttributeValues: {
                        ':entityType': 'ORDER',
                        ':status': status
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetOrdersByStatus',
            'SingleTable',
            'Query',
            1,
            true,
            'EntityTypeIndex'
        );
    }

    // Table metrics methods
    async getTableItemCount(): Promise<number> {
        try {
            const command = new DescribeTableCommand({
                TableName: this.tableName
            });

            const response = await this.dynamoClient.send(command);
            return response.Table?.ItemCount || 0;
        } catch (error) {
            console.error(`Error getting item count for table ${this.tableName}:`, error);
            return 0;
        }
    }

    async logTableItemCount(): Promise<void> {
        const count = await this.getTableItemCount();
        console.info(`  Table ${this.tableName}: ${count.toLocaleString()} items`);
    }
} 