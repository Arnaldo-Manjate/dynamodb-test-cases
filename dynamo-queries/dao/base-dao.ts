import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { TestResult } from '../@types';

export abstract class BaseDAO {
    protected client: DynamoDBDocumentClient;
    protected dynamoClient: DynamoDBClient;
    protected region: string;

    constructor(region: string = 'us-east-1') {
        this.region = region;

        this.dynamoClient = new DynamoDBClient({ region });
        this.client = DynamoDBDocumentClient.from(this.dynamoClient);
    }

    protected async measureOperation<T>(
        operation: () => Promise<T>,
        operationName: string,
        design: 'Relational' | 'SingleTable',
        itemCount: number = 1
    ): Promise<TestResult> {
        const startTime = Date.now();

        try {
            const result = await operation();

            const duration = Date.now() - startTime;

            // Extract consumed capacity and actual item count from result
            let consumedCapacity;
            let actualItemCount = itemCount; // Default to requested count

            if (result && typeof result === 'object' && 'ConsumedCapacity' in result) {
                const consumed = (result as any).ConsumedCapacity;
                if (consumed) {
                    consumedCapacity = {
                        readCapacityUnits: consumed.CapacityUnits || 0,
                    };
                }
            }

            // Extract actual item count from result
            if (result && typeof result === 'object') {
                if ('Items' in result && Array.isArray((result as any).Items)) {
                    actualItemCount = (result as any).Items.length;
                } else if ('Item' in result && (result as any).Item) {
                    actualItemCount = 1;
                } else if ('Count' in result) {
                    actualItemCount = (result as any).Count || 0;
                }
            }

            return {
                operation: operationName,
                design,
                duration,
                consumedCapacity,
                itemCount: actualItemCount, // Use actual count, not requested count
                success: true
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            return {
                operation: operationName,
                design,
                duration,
                itemCount: 0,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    protected async putItem(tableName: string, item: Record<string, any>): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                try {
                    const command = new PutCommand({
                        TableName: tableName,
                        Item: item,
                        ReturnConsumedCapacity: "TOTAL"
                    });
                    const result = await this.client.send(command);
                    console.log(`✅ PutItem successful for table ${tableName}, item:`, item);
                    return result;
                } catch (error) {
                    console.error(`❌ PutItem failed for table ${tableName}:`, error);
                    console.error(`   Item:`, item);
                    if (error instanceof Error) {
                        console.error(`   Error message: ${error.message}`);
                        if ('name' in error) {
                            console.error(`   Error type: ${(error as any).name}`);
                        }
                    }
                    throw error; // Re-throw to be caught by measureOperation
                }
            },
            'PutItem',
            this.getDesignType(),
            1
        );
    }

    protected async getItem(tableName: string, key: Record<string, any>): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                const command = new GetCommand({
                    TableName: tableName,
                    Key: key,
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetItem',
            this.getDesignType(),
            1
        );
    }

    protected async query(
        tableName: string,
        keyConditionExpression: string,
        expressionAttributeValues: Record<string, any>,
        indexName?: string
    ): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                const command = new QueryCommand({
                    TableName: tableName,
                    KeyConditionExpression: keyConditionExpression,
                    ExpressionAttributeValues: expressionAttributeValues,
                    IndexName: indexName,
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'Query',
            this.getDesignType(),
            1
        );
    }

    protected async scan(tableName: string, filterExpression?: string, expressionAttributeValues?: Record<string, any>): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                const command = new ScanCommand({
                    TableName: tableName,
                    FilterExpression: filterExpression,
                    ExpressionAttributeValues: expressionAttributeValues,
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'Scan',
            this.getDesignType(),
            1
        );
    }

    protected async batchWrite(tableName: string, items: Record<string, any>[]): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                const writeRequests = items.map(item => ({
                    PutRequest: { Item: item }
                }));

                const command = new BatchWriteCommand({
                    RequestItems: {
                        [tableName]: writeRequests
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });

                return await this.client.send(command);
            },
            'BatchWrite',
            this.getDesignType(),
            items.length
        );
    }

    // Reusable batching method to handle DynamoDB's 25-item limit
    protected async batchWriteWithChunking(
        items: Record<string, any>[],
        tableName: string,
        operationName: string
    ): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // Simple batching: split into chunks of 25
                const BATCH_SIZE = 25;
                let totalCapacity = 0;
                let failedCount = 0;
                let successfulCount = 0;

                for (let i = 0; i < items.length; i += BATCH_SIZE) {
                    const batch = items.slice(i, i + BATCH_SIZE);
                    const writeRequests = batch.map(item => ({
                        PutRequest: { Item: item }
                    }));

                    try {
                        const command = new BatchWriteCommand({
                            RequestItems: {
                                [tableName]: writeRequests
                            },
                            ReturnConsumedCapacity: "TOTAL"
                        });

                        const result = await this.client.send(command);

                        // Check for unprocessed items (partial failures)
                        if (result.UnprocessedItems && Object.keys(result.UnprocessedItems).length > 0) {
                            console.error(`⚠️  Batch ${Math.floor(i / BATCH_SIZE) + 1} had unprocessed items:`, result.UnprocessedItems);
                            failedCount += batch.length;
                        } else {
                            successfulCount += batch.length;
                        }

                        totalCapacity += (result.ConsumedCapacity as any)?.CapacityUnits || 0;

                        console.log(`✅Batch ${Math.floor(i / BATCH_SIZE) + 1}: Processed ${batch.length} items successfully`);

                    } catch (error) {
                        console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error);
                        failedCount += batch.length;

                        // Log the specific error details
                        if (error instanceof Error) {
                            console.error(`   Error message: ${error.message}`);
                            if ('name' in error) {
                                console.error(`   Error type: ${(error as any).name}`);
                            }
                        }
                    }
                }

                // Log summary
                console.log(`📊 Batch operation summary: ${successfulCount} successful, ${failedCount} failed`);

                if (failedCount > 0) {
                    console.error(`❌ Failed items count: ${failedCount}`);
                }

                return {
                    Items: items,
                    Count: successfulCount,
                    ConsumedCapacity: { CapacityUnits: totalCapacity },
                    FailedCount: failedCount
                };
            },
            operationName,
            this.getDesignType(),
            items.length
        );
    }

    protected abstract getDesignType(): 'Relational' | 'SingleTable';
} 