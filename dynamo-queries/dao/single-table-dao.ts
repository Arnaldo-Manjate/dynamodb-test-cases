import { BaseDAO, } from './base-dao';
import { TestResult } from '../@types/index'
import { QueryCommand, GetCommand, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

export class SingleTableDAO extends BaseDAO {
    private tableName: string;

    constructor(tableName: string, region: string = 'us-east-1') {
        super(region);
        this.tableName = tableName;
    }

    protected getDesignType(): 'SingleTable' {
        return 'SingleTable';
    }

    // Point 1: Proper Sort Keys - Good Pattern
    // Efficient queries with PK + SK combination
    async getUserPosts(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // GOOD: Using PK + SK pattern for efficient queries
                const command = new QueryCommand({
                    TableName: this.tableName,
                    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
                    ExpressionAttributeValues: {
                        ':pk': `USER#${userId}`,
                        ':skPrefix': 'POST#'
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetUserPosts_WithSortKey',
            'SingleTable',
            1
        );
    }

    // Point 2: Generic Naming - Good Pattern
    // Using generic PK/SK instead of specific field names
    async getUserById(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // GOOD: Generic PK/SK pattern provides flexibility
                const command = new GetCommand({
                    TableName: this.tableName,
                    Key: {
                        PK: `USER#${userId}`,
                        SK: `USER#${userId}`
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetUser_GenericNaming',
            'SingleTable',
            1
        );
    }

    // Point 3: Strategic GSI Usage - Good Pattern
    // Fewer GSIs needed due to sort key power
    async getPostsByDateRange(userId: string, startDate: string, endDate: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // GOOD: Can use main table efficiently with PK + SK range
                const command = new QueryCommand({
                    TableName: this.tableName,
                    KeyConditionExpression: 'PK = :pk AND SK BETWEEN :startSk AND :endSk',
                    ExpressionAttributeValues: {
                        ':pk': `USER#${userId}`,
                        ':startSk': `POST#00000000#${startDate}`,
                        ':endSk': `POST#99999999#${endDate}`
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetPostsByDateRange_NoGSINeeded',
            'SingleTable',
            1
        );
    }

    // Point 4: Generic GSI Names - Good Pattern
    // Using generic names for infrequently accessed patterns
    async getUserPostsWithGSI(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // GOOD: Generic GSI name for infrequently accessed pattern
                const command = new QueryCommand({
                    TableName: this.tableName,
                    IndexName: 'EntityTypeIndex', // Generic name
                    KeyConditionExpression: 'entityType = :entityType AND begins_with(SK, :skPrefix)',
                    FilterExpression: 'begins_with(PK, :userPrefix)',
                    ExpressionAttributeValues: {
                        ':entityType': 'POST',
                        ':skPrefix': `POST#`,
                        ':userPrefix': `USER#${userId}`
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetUserPostsWithGSI_GenericNaming',
            'SingleTable',
            1
        );
    }

    // Point 5: Single Query Efficiency - Good Pattern
    // Get user + posts in one efficient query
    async getUserWithPosts(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // GOOD: Single query gets user + all their posts
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
            'GetUserWithPosts_SingleQuery',
            'SingleTable',
            1
        );
    }

    // Point 6: Efficient Access Patterns - Good Pattern
    // Strategic GSI usage for global queries
    async getAllPosts(): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // GOOD: Efficient GSI query instead of scan
                const command = new QueryCommand({
                    TableName: this.tableName,
                    IndexName: 'EntityTypeIndex',
                    KeyConditionExpression: 'entityType = :entityType',
                    ExpressionAttributeValues: {
                        ':entityType': 'POST'
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetAllPosts_EfficientGSI',
            'SingleTable',
            1
        );
    }

    // Data insertion methods
    async createUser(user: any): Promise<TestResult> {
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
            1
        );
    }

    async createPost(post: any): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                const command = new PutCommand({
                    TableName: this.tableName,
                    Item: post,
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'CreatePost',
            'SingleTable',
            1
        );
    }

    async batchCreateItems(items: any[]): Promise<TestResult> {
        return this.batchWriteWithChunking(items, this.tableName, 'BatchCreateItems');
    }
} 