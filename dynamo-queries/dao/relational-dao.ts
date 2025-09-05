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
    private postsTableName: string;
    private commentsTableName: string;
    private followersTableName: string;
    private userFollowingTableName: string;
    private likesTableName: string;

    constructor(usersTableName: string, postsTableName: string, commentsTableName: string, followersTableName: string, userFollowingTableName: string, likesTableName: string, region: string = 'us-east-1') {
        super(region);
        this.usersTableName = usersTableName;
        this.postsTableName = postsTableName;
        this.commentsTableName = commentsTableName;
        this.followersTableName = followersTableName;
        this.userFollowingTableName = userFollowingTableName;
        this.likesTableName = likesTableName;
    }

    protected getDesignType(): 'Relational' {
        return 'Relational';
    }

    // Getter methods for table names and client access
    get getUsersTableName(): string { return this.usersTableName; }
    get getPostsTableName(): string { return this.postsTableName; }
    get getCommentsTableName(): string { return this.commentsTableName; }
    get getFollowersTableName(): string { return this.followersTableName; }
    get getUserFollowingTableName(): string { return this.userFollowingTableName; }
    get getLikesTableName(): string { return this.likesTableName; }
    get getClient() { return this.client; }

    // Point 1: Missing Sort Keys - Bad Pattern
    // This forces GSI creation for date-based queries
    async getUserPosts(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // BAD: Main table's PK is postId, so we need a GSI to query by userId
                // This means maintaining an extra index just for this access pattern

                // BAD: Have to scan because we can't query by non-key attribute
                const command = new ScanCommand({
                    TableName: this.postsTableName,
                    FilterExpression: 'userId = :userId',
                    ExpressionAttributeValues: { ':userId': userId },
                    ReturnConsumedCapacity: "TOTAL"
                });

                const result = await this.client.send(command);
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



    // Inefficient Access Patterns - Bad Pattern
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
                // BAD: Multiple network requests required for relational design
                // 1. Get user
                const userCommand = new GetCommand({
                    TableName: this.usersTableName,
                    Key: { PK: userId },
                    ReturnConsumedCapacity: "TOTAL"
                });
                const user = await this.client.send(userCommand);
                requestCount++;
                // 2. Get user posts (requires GSI since main table has postId as PK)
                const postsCommand = new QueryCommand({
                    TableName: this.postsTableName,
                    IndexName: 'PostsByDateIndex',
                    KeyConditionExpression: 'userId = :userId',
                    ExpressionAttributeValues: { ':userId': userId },
                    ReturnConsumedCapacity: "TOTAL"
                });
                const posts = await this.client.send(postsCommand);
                requestCount++;
                // 3. Get comments on user's posts (not comments by the user)
                let allComments: any[] = [];
                let commentsCapacity = 0;
                if (posts.Items && posts.Items.length > 0) {
                    for (const post of posts.Items) {
                        const commentsCommand = new QueryCommand({
                            TableName: this.commentsTableName,
                            KeyConditionExpression: 'postId = :postId',
                            ExpressionAttributeValues: {
                                ':postId': post.postId
                            },
                            ReturnConsumedCapacity: "TOTAL"
                        });
                        requestCount++;
                        const postComments = await this.client.send(commentsCommand);
                        if (postComments.Items) {
                            allComments.push(...postComments.Items);
                        }
                        requestCount++;
                        commentsCapacity += postComments.ConsumedCapacity?.CapacityUnits || 0;
                    }
                }

                // 4. Get user followers 
                const followersCommand = new QueryCommand({
                    TableName: this.followersTableName,
                    KeyConditionExpression: 'followingId = :followingId',
                    ExpressionAttributeValues: { ':followingId': userId },
                    ReturnConsumedCapacity: "TOTAL"
                });
                const followers = await this.client.send(followersCommand);
                requestCount++;
                // 5. Get likes on user's posts (not likes by the user)
                let allLikes: any[] = [];
                let likesCapacity = 0;
                if (posts.Items && posts.Items.length > 0) {
                    for (const post of posts.Items) {
                        const likesCommand = new QueryCommand({
                            TableName: this.likesTableName,
                            KeyConditionExpression: 'postId = :postId',
                            ExpressionAttributeValues: {
                                ':postId': post.postId
                            },
                            ReturnConsumedCapacity: "TOTAL"
                        });
                        const postLikes = await this.client.send(likesCommand);
                        requestCount++;
                        if (postLikes.Items) {
                            allLikes.push(...postLikes.Items);
                        }
                        likesCapacity += postLikes.ConsumedCapacity?.CapacityUnits || 0;
                    }
                }

                // Return combined result with proper consumed capacity
                const totalCapacity = (user.ConsumedCapacity?.CapacityUnits || 0) +
                    (posts.ConsumedCapacity?.CapacityUnits || 0) +
                    commentsCapacity +
                    (followers.ConsumedCapacity?.CapacityUnits || 0) +
                    likesCapacity;

                // Request count is tracked by incrementRequestCount() in base DAO
                // Each call to client.send() increments the counter

                return {
                    user: user.Item,
                    posts: posts.Items,
                    comments: allComments,
                    followers: followers.Items,
                    likes: allLikes,
                    ConsumedCapacity: {
                        CapacityUnits: totalCapacity
                    },
                    Items: [
                        user.Item,
                        ...(posts.Items || []),
                        ...allComments,
                        ...(followers.Items || []),
                        ...allLikes
                    ],
                    Count: 1 + (posts.Count || 0) + allComments.length + (followers.Count || 0) + allLikes.length,
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

    async batchCreateComments(comments: any[]): Promise<TestResult> {
        return this.batchWriteWithChunking(comments, this.commentsTableName, 'BatchCreateComments');
    }

    async batchCreateFollowers(followers: any[]): Promise<TestResult> {
        return this.batchWriteWithChunking(followers, this.followersTableName, 'BatchCreateFollowers');
    }

    async batchCreateUserFollowing(userFollowings: any[]): Promise<TestResult> {
        return this.batchWriteWithChunking(userFollowings, this.userFollowingTableName, 'BatchCreateUserFollowing');
    }

    async batchCreateLikes(likes: any[]): Promise<TestResult> {
        return this.batchWriteWithChunking(likes, this.likesTableName, 'BatchCreateLikes');
    }

    // Point 6: Multiple Queries Required - Bad Pattern
    // Need to first get all posts by user, then query each post for comments
    async getAllUserComments(userId: string): Promise<TestResult> {
        return this.measureOperation(
            async () => {
                // BAD: Multiple network requests required
                // 1. First get all posts by the user
                const postsCommand = new QueryCommand({
                    TableName: this.postsTableName,
                    IndexName: 'PostsByDateIndex',
                    KeyConditionExpression: 'userId = :userId',
                    ExpressionAttributeValues: { ':userId': userId },
                    ReturnConsumedCapacity: "TOTAL"
                });
                const posts = await this.client.send(postsCommand);

                // 2. Then get comments for each post
                let allComments: any[] = [];
                let totalCapacity = posts.ConsumedCapacity?.CapacityUnits || 0;

                if (posts.Items && posts.Items.length > 0) {
                    for (const post of posts.Items) {
                        const commentsCommand = new QueryCommand({
                            TableName: this.commentsTableName,
                            KeyConditionExpression: 'postId = :postId',
                            ExpressionAttributeValues: {
                                ':postId': post.postId
                            },
                            ReturnConsumedCapacity: "TOTAL"
                        });
                        const postComments = await this.client.send(commentsCommand);
                        if (postComments.Items) {
                            allComments.push(...postComments.Items);
                        }
                        totalCapacity += postComments.ConsumedCapacity?.CapacityUnits || 0;
                    }
                }

                return {
                    Items: allComments,
                    Count: allComments.length,
                    ConsumedCapacity: {
                        CapacityUnits: totalCapacity
                    }
                };
            },
            'GetAllUserComments_MultipleQueries',
            'Relational',
            1
        );
    }
} 