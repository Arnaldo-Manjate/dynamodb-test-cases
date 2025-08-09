import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, BatchWriteCommand, BatchGetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { TestResult } from '../types';

export abstract class BaseDAO {
    protected client: DynamoDBDocumentClient;
    protected dynamoClient: DynamoDBClient;
    protected tableName: string;

    constructor(tableName: string, region?: string) {
        // Use environment variable or default to us-east-1
        const awsRegion = region || process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || 'us-east-1';

        console.log(`Initializing DAO for table: ${tableName} in region: ${awsRegion}`);

        this.dynamoClient = new DynamoDBClient({
            region: awsRegion,
            // Add retry configuration for better reliability
            maxAttempts: 3
        });

        this.client = DynamoDBDocumentClient.from(this.dynamoClient);
        this.tableName = tableName;
    }

    // Get table item count using DescribeTable API
    // Note: ItemCount is only updated approximately every 6 hours
    // Reference: https://aws.amazon.com/blogs/database/obtaining-item-counts-in-amazon-dynamodb/
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

    // Get table item count with console output
    async logTableItemCount(): Promise<void> {
        const count = await this.getTableItemCount();
        console.info(`  Table ${this.tableName}: ${count.toLocaleString()} items`);
    }

    protected async measureOperation<T>(
        operation: () => Promise<T>,
        testName: string,
        design: 'Relational' | 'SingleTable',
        operationType: 'GetItem' | 'Query' | 'BatchWrite' | 'BatchGet',
        itemCount: number = 1,
        usedGSI: boolean = false,
        gsiName?: string
    ): Promise<TestResult> {
        const startTime = Date.now();
        const startTimestamp = performance.now();

        try {
            const result = await operation();
            const endTime = Date.now();
            const endTimestamp = performance.now();
            const duration = endTime - startTime;
            const processingTime = endTimestamp - startTimestamp;

            // Calculate record count based on operation result
            let recordCount = 1; // Default for single item operations

            if (result && typeof result === 'object') {
                if ('Items' in result && Array.isArray((result as any).Items)) {
                    // Query/Scan result
                    recordCount = (result as any).Items.length;
                } else if ('Count' in result && typeof (result as any).Count === 'number') {
                    // Query/Scan result with count
                    recordCount = (result as any).Count;
                } else if (Array.isArray(result)) {
                    // Batch operation result
                    recordCount = result.length;
                } else if ('Item' in result && (result as any).Item) {
                    // GetItem result
                    recordCount = 1;
                } else if ('UnprocessedItems' in result || 'ConsumedCapacity' in result) {
                    // BatchWrite result - count processed items
                    recordCount = itemCount; // Use the expected item count
                }
            }

            // Extract consumed capacity from result if available
            let consumedCapacity = undefined;
            let rcuConsumed = 0;
            let wcuConsumed = 0;
            let estimatedCost = 0;

            if (result && typeof result === 'object' && 'ConsumedCapacity' in result) {
                const consumed = (result as any).ConsumedCapacity;
                if (consumed) {
                    consumedCapacity = {
                        readCapacityUnits: consumed.ReadCapacityUnits,
                        writeCapacityUnits: consumed.WriteCapacityUnits,
                        tableName: consumed.TableName,
                        indexName: consumed.GlobalSecondaryIndexes?.[0]?.IndexName
                    };
                    rcuConsumed = consumed.ReadCapacityUnits || 0;
                    wcuConsumed = consumed.WriteCapacityUnits || 0;

                    // Estimate cost (rough calculation)
                    // RCU: $0.25 per million reads, WCU: $1.25 per million writes
                    const rcuCost = (rcuConsumed / 1000000) * 0.25;
                    const wcuCost = (wcuConsumed / 1000000) * 1.25;
                    estimatedCost = rcuCost + wcuCost;
                }
            }

            return {
                testName,
                design,
                operation: operationType,
                duration,
                consumedCapacity,
                itemCount,
                recordCount,
                success: true,
                startTime,
                endTime,
                usedGSI,
                gsiName,
                processingTime,
                rcuConsumed,
                wcuConsumed,
                estimatedCost
            };
        } catch (error) {
            const endTime = Date.now();
            const duration = endTime - startTime;

            // Enhanced error logging
            if (error instanceof Error) {
                console.error(`❌ ${testName} failed: ${error.message}`);
                if (error.message.includes('credentials')) {
                    console.error('💡 Make sure your AWS credentials are configured: aws configure');
                }
            }

            return {
                testName,
                design,
                operation: operationType,
                duration,
                itemCount,
                recordCount: 0,
                success: false,
                error: error instanceof Error ? error.message : String(error),
                startTime,
                endTime,
                usedGSI,
                gsiName
            };
        }
    }

    async getItem(key: Record<string, any>): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                const command = new GetCommand({
                    TableName: this.tableName,
                    Key: key,
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetItem',
            this.getDesignType(),
            'GetItem'
        );
    }

    async query(
        keyConditionExpression: string,
        expressionAttributeValues: Record<string, any>,
        indexName?: string
    ): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                const command = new QueryCommand({
                    TableName: this.tableName,
                    KeyConditionExpression: keyConditionExpression,
                    ExpressionAttributeValues: expressionAttributeValues,
                    IndexName: indexName,
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'Query',
            this.getDesignType(),
            'Query'
        );
    }

    async batchWrite(items: Record<string, any>[]): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // Split items into batches of 25 (DynamoDB limit)
                const batches = this.chunkArray(items, 25);
                const results = [];

                for (const batch of batches) {
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
                }

                return results;
            },
            'BatchWrite',
            this.getDesignType(),
            'BatchWrite',
            items.length
        );
    }

    async batchGet(keys: Record<string, any>[]): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // Split keys into batches of 100 (DynamoDB limit)
                const batches = this.chunkArray(keys, 100);
                const results = [];

                for (const batch of batches) {
                    const command = new BatchGetCommand({
                        RequestItems: {
                            [this.tableName]: {
                                Keys: batch
                            }
                        },
                        ReturnConsumedCapacity: "TOTAL"
                    });

                    results.push(await this.client.send(command));
                }

                return results;
            },
            'BatchGet',
            this.getDesignType(),
            'BatchGet',
            keys.length
        );
    }

    protected chunkArray<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    protected abstract getDesignType(): 'Relational' | 'SingleTable';
} 