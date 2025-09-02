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
 * - Single query retrieves all user data (user, posts, comments, followers, likes)
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
                        ':skPrefix': 'POSTS#'
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
                // GOOD: No GSI needed - can use main table efficiently
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
            'GetUserPosts_NoGSINeeded',
            'SingleTable',
            1
        );
    }

    // ========================================
    // POINTS 3 & 4 MERGED: STATIC IDENTIFIERS + POWERFUL QUERIES
    // Demonstrates: How static identifiers on PK and SK enable powerful queries
    // Single query gets all user data while maintaining individual access patterns
    // ========================================

    // Point 3 & 4: Main Table for All User Data - Excellent Pattern
    // Using main table with PK=USER#userId and SK begins_with to get all entity types in one query
    // 
    // Key Structure:
    // - PK: USER#userId (Partition Key) - groups all entities for a specific user
    // - SK: #ENTITY#date (Sort Key) - enables efficient queries and date-based ordering
    //
    // This demonstrates the power of proper single table design - no GSI needed!
    async getUserScreenData(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // EXCELLENT: Single query using main table with PK=USER#userId
                // This gets all entity types for a user in one efficient query
                const command = new QueryCommand({
                    TableName: this.tableName,
                    KeyConditionExpression: 'PK = :pk',
                    ExpressionAttributeValues: {
                        ':pk': `USER#${userId}`
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });

                const result = await this.client.send(command);

                // Efficient: Loop once and push to right arrays
                const posts: any[] = [];
                const comments: any[] = [];
                const followers: any[] = [];
                const likes: any[] = [];

                if (result.Items) {
                    for (const item of result.Items) {
                        switch (item.entityType) {
                            case EntityType.POST:
                                posts.push(item);
                                break;
                            case EntityType.COMMENT:
                                comments.push(item);
                                break;
                            case EntityType.FOLLOWER:
                                followers.push(item);
                                break;
                            case EntityType.LIKE:
                                likes.push(item);
                                break;
                        }
                    }
                }

                return {
                    posts,
                    comments,
                    followers,
                    likes,
                    ConsumedCapacity: result.ConsumedCapacity,
                    Items: result.Items || [],
                    Count: result.Count || 0
                };
            },
            'GetUserScreenData_MainTable_SingleQuery_WithFilter',
            'SingleTable',
            1
        );
    }

    // Individual access patterns maintained for specific entity queries
    // These demonstrate that we can still query individual entity types efficiently
    async getUserPostsOnly(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // GOOD: Can still query just posts efficiently
                const command = new QueryCommand({
                    TableName: this.tableName,
                    KeyConditionExpression: 'PK = :pk',
                    ExpressionAttributeValues: {
                        ':pk': `POST#${userId}`
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetUserPostsOnly_IndividualAccess',
            'SingleTable',
            1
        );
    }

    async getUserCommentsOnly(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // GOOD: Can still query just comments efficiently
                const command = new QueryCommand({
                    TableName: this.tableName,
                    KeyConditionExpression: 'PK = :pk',
                    ExpressionAttributeValues: {
                        ':pk': `COMMENT#${userId}`
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetUserCommentsOnly_IndividualAccess',
            'SingleTable',
            1
        );
    }

    async getUserFollowersOnly(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // GOOD: Can still query just followers efficiently
                const command = new QueryCommand({
                    TableName: this.tableName,
                    KeyConditionExpression: 'PK = :pk',
                    ExpressionAttributeValues: {
                        ':pk': `FOLLOWER#${userId}`
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetUserFollowersOnly_IndividualAccess',
            'SingleTable',
            1
        );
    }

    async getUserLikesOnly(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // GOOD: Can still query just likes efficiently
                const command = new QueryCommand({
                    TableName: this.tableName,
                    KeyConditionExpression: 'PK = :pk',
                    ExpressionAttributeValues: {
                        ':pk': `LIKE#${userId}`
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetUserLikesOnly_IndividualAccess',
            'SingleTable',
            1
        );
    }



    // Efficient Access Patterns - Good Pattern
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
                        ':entityType': EntityType.POST
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

    // Point 6: GSI Overloading for Infrequent Access Patterns
    // Using GSI1 to efficiently get all comments by a user across all posts
    async getAllUserComments(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // GOOD: Using overloaded GSI1 for infrequent access pattern
                const command = new QueryCommand({
                    TableName: this.tableName,
                    IndexName: 'GSI1',
                    KeyConditionExpression: 'GSI1PK = :gsi1pk',
                    ExpressionAttributeValues: {
                        ':gsi1pk': `USER_COMMENTS#${userId}`
                    },
                    ReturnConsumedCapacity: "TOTAL"
                });
                return await this.client.send(command);
            },
            'GetAllUserComments_GSI1',
            'SingleTable',
            1
        );
    }
} 