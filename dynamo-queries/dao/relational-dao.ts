import { BaseDAO } from './base-dao';
import { TestResult } from '../@types';
import { QueryCommand, GetCommand, ScanCommand, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

export class RelationalDAO extends BaseDAO {
    private usersTableName: string;
    private postsTableName: string;

    constructor(usersTableName: string, postsTableName: string, region: string = 'us-east-1') {
        super(region);
        this.usersTableName = usersTableName;
        this.postsTableName = postsTableName;
    }

    protected getDesignType(): 'Relational' {
        return 'Relational';
    }

    // Point 1: Missing Sort Keys - Bad Pattern
    // This forces GSI creation for date-based queries
    async getUserPosts(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // BAD: PK is postId, not userId, so we can't query by userId efficiently
                // We have to scan the entire table to find posts by a specific user
                console.log(`   🔍 Scanning posts table for userId: ${userId}`);

                const command = new ScanCommand({
                    TableName: this.postsTableName,
                    FilterExpression: 'userId = :userId',
                    ExpressionAttributeValues: { ':userId': userId },
                    ReturnConsumedCapacity: "TOTAL"
                });

                const result = await this.client.send(command);
                console.log(`   📊 Scan result: ${result.Items?.length || 0} items found, ScannedCount: ${result.ScannedCount}`);

                return result;
            },
            'GetUserPosts_NoSortKey',
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
                    Key: { PK: userId }, // Should be generic PK/SK
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
    async getPostsByDateRange(userId: string, startDate: string, endDate: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // BAD: Forced to use GSI because no sort key on main table
                // The GSI has userId as PK and createdAt as SK, but main table has postId as PK
                const command = new QueryCommand({
                    TableName: this.postsTableName,
                    IndexName: 'PostsByDateIndex', // Forced GSI usage
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
            'GetPostsByDateRange_GSIRequired',
            'Relational',
            1
        );
    }

    // Point 4: GSI Naming Anti-patterns - Bad Pattern
    // Using descriptive names instead of generic names
    async getUserPostsWithGSI(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // BAD: Descriptive GSI name instead of generic
                // BAD: Forced to use GSI because main table schema is poor
                const command = new QueryCommand({
                    TableName: this.postsTableName,
                    IndexName: 'PostsByDateIndex', // Should be GSI1, GSI2, etc.
                    KeyConditionExpression: 'userId = :userId',
                    ExpressionAttributeValues: { ':userId': userId },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetUserPosts_DescriptiveGSI',
            'Relational',
            1
        );
    }

    // Point 5: Multiple Queries - Bad Pattern
    // Need multiple queries to get user + posts
    async getUserWithPosts(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // BAD: Multiple queries needed
                // 1. Get user
                const userCommand = new GetCommand({
                    TableName: this.usersTableName,
                    Key: { PK: userId },
                    ReturnConsumedCapacity: "TOTAL"
                });
                const user = await this.client.send(userCommand);

                // 2. Get posts using GSI (since main table can't query by userId)
                const postsCommand = new QueryCommand({
                    TableName: this.postsTableName,
                    IndexName: 'PostsByDateIndex',
                    KeyConditionExpression: 'userId = :userId',
                    ExpressionAttributeValues: { ':userId': userId },
                    ReturnConsumedCapacity: "TOTAL"
                });
                const posts = await this.client.send(postsCommand);

                // Return combined result with proper consumed capacity
                return {
                    user: user.Item,
                    posts: posts.Items,
                    ConsumedCapacity: {
                        CapacityUnits: (user.ConsumedCapacity?.CapacityUnits || 0) +
                            (posts.ConsumedCapacity?.CapacityUnits || 0)
                    },
                    Items: [user.Item, ...(posts.Items || [])], // Combine items for count
                    Count: 1 + (posts.Count || 0) // User + posts count
                };
            },
            'GetUserWithPosts_MultipleQueries',
            'Relational',
            1
        );
    }

    // Point 6: Inefficient Access Patterns - Bad Pattern
    // Scan operation due to poor schema design
    async getAllPosts(): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // BAD: Scan operation because no efficient access pattern
                const command = new ScanCommand({
                    TableName: this.postsTableName,
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetAllPosts_ScanRequired',
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

    async createPost(post: any): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                const command = new PutCommand({
                    TableName: this.postsTableName,
                    Item: post,
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'CreatePost',
            'Relational',
            1
        );
    }

    async batchCreateUsers(users: any[]): Promise<TestResult> {
        return this.batchWriteWithChunking(users, this.usersTableName, 'BatchCreateUsers');
    }

    async batchCreatePosts(posts: any[]): Promise<TestResult> {
        return this.batchWriteWithChunking(posts, this.postsTableName, 'BatchCreatePosts');
    }
} 