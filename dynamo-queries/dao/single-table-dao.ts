import { BaseDAO, } from './base-dao';
import { TestResult, EntityType } from '../@types/index'
import { QueryCommand, GetCommand, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

/**
 * Single Table Design DAO - Demonstrates Best Practices
 * 
 * DESIGN PHILOSOPHY: We design our access patterns for the most frequently accessed data.
 * 
 * This implementation shows how static identifiers on PK and SK enable powerful queries
 * that are not possible with relational DBs, while maintaining individual access patterns
 * for specific entity types. No LSI or GSI is needed for common access patterns.
 * 
 * Key Benefits:
 * - Single query retrieves all user data (user, posts, comments)
 * - Individual entity queries remain efficient using begins_with on SK
 * - Static identifiers (USER#, POST#, COMMENT#, etc.) organize data logically
 * - No index complexity for frequently accessed patterns
 */
export class SingleTableDAO extends BaseDAO {
    private tableName: string;

    constructor(tableName: string, region: string = 'us-east-1') {
        super(region);
        this.tableName = tableName;
    }

    protected getDesignType(): 'SingleTable' {
        return 'SingleTable';
    }

    // Getter methods for table name and client access
    get getTableName(): string { return this.tableName; }
    get getClient() { return this.client; }


    // Will be slower than singleTable getItem but offers more flexible 
    // access patterns for the user entity.
    async getUserById(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // GOOD: Generic PK/SK pattern provides flexibility
                const command = new QueryCommand({
                    TableName: this.tableName,
                    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
                    ExpressionAttributeValues: {
                        ':pk': `${EntityType.USER}#${userId}`,
                        ':skPrefix': "active#"
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetUserById',
            'SingleTable',
            1
        );
    }

    async getAllUsers(): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // GOOD: Generic PK/SK pattern provides flexibility
                const command = new QueryCommand({
                    TableName: this.tableName,
                    IndexName: 'GSI1',
                    KeyConditionExpression: 'GSI1PK = :pk',
                    ExpressionAttributeValues: {
                        ':pk': `${EntityType.USER}`,
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetAllUsers',
            'SingleTable',
            1
        );
    }

    async getUsersByStatus(status: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // GOOD: Generic PK/SK pattern provides flexibility
                const command = new QueryCommand({
                    TableName: this.tableName,
                    IndexName: 'GSI1',
                    KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :skPrefix)',
                    ExpressionAttributeValues: {
                        ':pk': `${EntityType.USER}`,
                        ':skPrefix': `${status}#`
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetUserByStatus',
            'SingleTable',
            1
        );
    }

    async getUserScreenData(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                //  Single query using main table with PK=USER#userId
                // This gets all entity types for a user in one efficient query
                const command = new QueryCommand({
                    TableName: this.tableName,
                    KeyConditionExpression: 'PK = :pk',
                    ExpressionAttributeValues: {
                        ':pk': `${userId}`,
                        // make the sort key start with the user id
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });

                return await this.client.send(command);
            },
            'GetUserScreenData',
            'SingleTable',
            1
        );
    }

    // Efficient Access Patterns - Good Pattern
    // Strategic GSI usage for global queries
    async getAllOrders(): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // GOOD: Efficient GSI query instead of scan
                const command = new QueryCommand({
                    TableName: this.tableName,
                    IndexName: 'GSI1',
                    KeyConditionExpression: 'GSI1PK = :pk',
                    ExpressionAttributeValues: {
                        ':pk': `${EntityType.ORDER}`
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetAllOrders_EfficientGSI',
            'SingleTable',
            1
        );
    }

    async getAllUserOrderItems(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // GOOD: Using overloaded GSI1 for infrequent access pattern
                const command = new QueryCommand({
                    TableName: this.tableName,
                    IndexName: 'GSI1',
                    KeyConditionExpression: 'GSI1PK = :gsi1pk',
                    ExpressionAttributeValues: {
                        ':gsi1pk': EntityType.ORDER_ITEM
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetAllUserOrderItems_GSI1',
            'SingleTable',
            1
        );
    }

    async batchCreateItems(items: any[]): Promise<TestResult> {
        return this.batchWriteWithChunking(items, this.tableName, 'BatchCreateItems');
    }

} 