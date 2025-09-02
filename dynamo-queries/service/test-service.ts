import { RelationalDAO } from '../dao/relational-dao';
import { SingleTableDAO } from '../dao/single-table-dao';
import { DataGenerator } from './data-generator';
import { TestResult, CompleteTestData } from '../@types';
import { ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

export class TestService {
    private relationalDAO: RelationalDAO;
    private singleTableDAO: SingleTableDAO;

    constructor(region: string = 'us-east-1') {
        this.relationalDAO = new RelationalDAO(
            'users-relational',
            'posts-relational',
            'comments-relational',
            'followers-relational',
            'user-following-relational',
            'likes-relational',
            region
        );
        this.singleTableDAO = new SingleTableDAO('single-table-social', region);
    }

    async runAllTests(
        userCount: number = 5,
        postCount: number = 20,
        commentCount: number = 50,
        likeCount: number = 100,
        skipDataInsertion: boolean = false
    ): Promise<void> {
        console.log('Starting DynamoDB Design Pattern Tests');

        try {
            if (!skipDataInsertion) {
                const hasData = await this.checkIfDataExists();
                if (!hasData) {
                    // Generate test data
                    console.log(`Generating test data: ${userCount} users, ${postCount} posts, ${commentCount} comments, ${likeCount} likes...`);
                    console.log(`Distribution: Random distribution across users`);
                    const testData: CompleteTestData = DataGenerator.generateTestData(
                        userCount,
                        postCount,
                        commentCount,
                        likeCount
                    );

                    // Log the generated data counts
                    console.log('📊 Generated Data Counts:');
                    console.log(`   - Relational Users: ${testData.relational.users.length}`);
                    console.log(`   - Relational Posts: ${testData.relational.posts.length}`);
                    console.log(`   - Relational Comments: ${testData.relational.comments.length}`);
                    console.log(`   - Relational Followers: ${testData.relational.followers.length}`);
                    console.log(`   - Relational User-Following: ${testData.relational.userFollowings.length}`);
                    console.log(`   - Relational Likes: ${testData.relational.likes.length}`);
                    console.log(`   - Single Table Users: ${testData.singleTable.users.length}`);
                    console.log(`   - Single Table Posts: ${testData.singleTable.posts.length}`);
                    console.log(`   - Single Table Comments: ${testData.singleTable.comments.length}`);
                    console.log(`   - Single Table Followers: ${testData.singleTable.followers.length}`);
                    console.log(`   - Single Table Likes: ${testData.singleTable.likes.length}`);

                    // Insert data
                    console.log('💾 Inserting test data...');
                    await this.insertTestData(testData);
                } else {
                    console.log('📋 Data already exists in tables - skipping insertion');
                }
            }

            await this.testPoint1();
            await this.testPoint2();
            await this.testMergedPoints(); // Merged points 3 and 4
            await this.testPoint5();
            await this.testPoint6();

            console.log('\n✅ All tests completed successfully!');
            console.log('📋 Check the output above to see the side-by-side comparison of each point.');

            // Summary of data points fetched
            console.log('\n📊 Summary of Data Points Fetched:');
            console.log('   Each test shows the actual number of items returned from DynamoDB operations.');
            console.log('   This demonstrates the efficiency of different design patterns in terms of data retrieval.');
            console.log('   Lower item counts with same functionality = better design!');

        } catch (error) {
            console.error('❌ Test execution failed:', error);
            throw error;
        }
    }

    // ========================================
    // DATA CLEARING FUNCTIONALITY
    // ========================================

    // Clear all data from both single table and relational tables
    async clearAllData(): Promise<void> {
        console.log('🗑️  Starting data clearing process...');

        try {
            // Clear relational tables
            console.log('  - Clearing relational tables...');
            await this.clearRelationalTables();

            // Clear single table
            console.log('  - Clearing single table...');
            await this.clearSingleTable();

            console.log('✅ All tables cleared successfully!');
        } catch (error) {
            console.error('❌ Error clearing data:', error);
            throw error;
        }
    }

    private async clearRelationalTables(): Promise<void> {
        const tables = [
            this.relationalDAO.getUsersTableName,
            this.relationalDAO.getPostsTableName,
            this.relationalDAO.getCommentsTableName,
            this.relationalDAO.getFollowersTableName,
            this.relationalDAO.getUserFollowingTableName,
            this.relationalDAO.getLikesTableName
        ];

        for (const tableName of tables) {
            console.log(`    - Clearing table: ${tableName}`);
            await this.clearTable(tableName);
        }
    }

    private async clearSingleTable(): Promise<void> {
        console.log(`    - Clearing table: ${this.singleTableDAO.getTableName}`);
        await this.clearTable(this.singleTableDAO.getTableName);
    }

    private async clearTable(tableName: string): Promise<void> {
        try {
            // Scan the table to get all items
            // Get the key schema based on the table name
            let keyAttributes: string[];
            switch (tableName) {
                case 'users-relational':
                    keyAttributes = ['PK'];
                    break;
                case 'posts-relational':
                    keyAttributes = ['postId'];
                    break;
                case 'comments-relational':
                    keyAttributes = ['postId', 'commentId'];
                    break;
                case 'followers-relational':
                    keyAttributes = ['followingId', 'followerId'];
                    break;
                case 'user-following-relational':
                    keyAttributes = ['followerId', 'followingId'];
                    break;
                case 'likes-relational':
                    keyAttributes = ['postId', 'likeId'];
                    break;
                case 'single-table-social':
                    keyAttributes = ['PK', 'SK'];
                    break;
                default:
                    throw new Error(`Unknown table: ${tableName}`);
            }

            const scanCommand = new ScanCommand({
                TableName: tableName,
                ProjectionExpression: keyAttributes.join(', ')
            });

            const result = await this.relationalDAO.getClient.send(scanCommand);

            if (result.Items && result.Items.length > 0) {
                console.log(`      - Found ${result.Items.length} items to delete`);

                // Delete items in batches of 25 (DynamoDB limit)
                const batchSize = 25;
                for (let i = 0; i < result.Items.length; i += batchSize) {
                    const batch = result.Items.slice(i, i + batchSize);

                    const deleteRequests = batch.map(item => {
                        // Create key based on table schema
                        const key: any = {};
                        keyAttributes.forEach(attr => {
                            key[attr] = item[attr];
                        });

                        return {
                            DeleteRequest: { Key: key }
                        };
                    });

                    const batchDeleteCommand = new BatchWriteCommand({
                        RequestItems: {
                            [tableName]: deleteRequests
                        }
                    });

                    await this.relationalDAO.getClient.send(batchDeleteCommand);
                }

                console.log(`      - Deleted ${result.Items.length} items`);
            } else {
                console.log(`      - Table is already empty`);
            }
        } catch (error) {
            console.error(`      - Error clearing table ${tableName}:`, error);
            throw error;
        }
    }

    private async insertTestData(testData: CompleteTestData): Promise<void> {
        // Insert users
        console.log('  - Inserting users...');
        await this.relationalDAO.batchCreateUsers(testData.relational.users);
        await this.singleTableDAO.batchCreateItems(testData.singleTable.users);

        // Insert posts
        console.log('  - Inserting posts...');
        await this.relationalDAO.batchCreatePosts(testData.relational.posts);
        await this.singleTableDAO.batchCreateItems(testData.singleTable.posts);

        // Insert comments
        console.log('  - Inserting comments...');
        await this.relationalDAO.batchCreateComments(testData.relational.comments);
        await this.singleTableDAO.batchCreateItems(testData.singleTable.comments);

        // Insert followers
        console.log('  - Inserting followers...');
        await this.relationalDAO.batchCreateFollowers(testData.relational.followers);
        await this.singleTableDAO.batchCreateItems(testData.singleTable.followers);

        // Insert user-following relationships
        console.log('  - Inserting user-following relationships...');
        await this.relationalDAO.batchCreateUserFollowing(testData.relational.userFollowings);

        // Insert likes
        console.log('  - Inserting likes...');
        await this.relationalDAO.batchCreateLikes(testData.relational.likes);
        await this.singleTableDAO.batchCreateItems(testData.singleTable.likes);

        console.log('Data insertion complete!');
    }

    // Check if data already exists in the tables
    private async checkIfDataExists(): Promise<boolean> {
        try {
            // Quick check - try to get one user from each table
            const userCheck = await this.relationalDAO.getUserById('user-00001');
            const postCheck = await this.relationalDAO.getUserPosts('user-00001');

            // If we get items back, data exists
            return userCheck.success && postCheck.success && postCheck.itemCount > 0;
        } catch (error) {
            return false; // Assume no data if check fails
        }
    }

    // Point 1: Missing Sort Keys vs Proper Sort Keys
    private async testPoint1(): Promise<void> {
        console.log('🔍 Point 1: Missing Sort Keys vs Proper Sort Keys');
        console.log('='.repeat(60));

        const testUserId = 'user-00001';

        // Bad Pattern: Relational (missing sort key)
        console.log('\n❌ BAD PATTERN - Relational Design:');
        console.log('   Table: posts-relational');
        console.log('   Schema: PK (postId) - MISSING SORT KEY');
        console.log('   Problem: Cannot efficiently query by userId, must scan entire table');

        const badResult = await this.relationalDAO.getUserPosts(testUserId);
        console.log(`   Result: ${badResult.duration}ms, RCU: ${badResult.consumedCapacity?.readCapacityUnits || 'N/A'}, Data Points Fetched: ${badResult.itemCount}`);

        // Good Pattern: Single Table (proper sort key)
        console.log('\n✅ GOOD PATTERN - Single Table Design:');
        console.log('   Table: single-table-social');
        console.log('   Schema: PK (USER#userId) + SK (POST#postId#date)');
        console.log('   Solution: Can efficiently query by userId + date range');

        const goodResult = await this.singleTableDAO.getUserPosts(testUserId);
        console.log(`   Result: ${goodResult.duration}ms, RCU: ${goodResult.consumedCapacity?.readCapacityUnits || 'N/A'}, Data Points Fetched: ${goodResult.itemCount}`);

        this.printComparison(badResult, goodResult);
    }

    // Point 2: Specific Naming vs Generic Naming
    private async testPoint2(): Promise<void> {
        console.log('\n🔍 Point 2: Specific Naming vs Generic Naming');
        console.log('='.repeat(60));

        const testUserId = 'user-00001';

        // Bad Pattern: Specific field names
        console.log('\n❌ BAD PATTERN - Relational Design:');
        console.log('   Schema: Specific field names (userId, email, username)');
        console.log('   Problem: Less flexible, harder to adapt to changing requirements');

        const badResult = await this.relationalDAO.getUserById(testUserId);
        console.log(`   Result: ${badResult.duration}ms, RCU: ${badResult.consumedCapacity?.readCapacityUnits || 'N/A'}, Data Points Fetched: ${badResult.itemCount}`);

        // Good Pattern: Generic PK/SK
        console.log('\n✅ GOOD PATTERN - Single Table Design:');
        console.log('   Schema: Generic PK/SK pattern');
        console.log('   Solution: Flexible, can store any entity type');

        const goodResult = await this.singleTableDAO.getUserById(testUserId);
        console.log(`   Result: ${goodResult.duration}ms, RCU: ${goodResult.consumedCapacity?.readCapacityUnits || 'N/A'}, Data Points Fetched: ${goodResult.itemCount}`);

        this.printComparison(badResult, goodResult);
    }

    // Test method for merged points 3 and 4
    private async testMergedPoints(): Promise<void> {
        console.log('\n🔍 Points 3 & 4: Static Identifiers Enable Powerful Queries vs Multiple Network Requests');
        console.log('='.repeat(80));

        const testUserId = 'user-00001';

        // Bad Pattern: Relational design requires multiple network requests
        console.log('\n❌ BAD PATTERN - Relational Design:');
        console.log('   Problem: Need 4+ separate network requests to get complete user data');
        console.log('   Requests: 1 for user + 1 for posts + N for comments (per post) + 1 for followers + N for likes (per post)');
        console.log('   Cost: Higher latency, more RCU consumption, network overhead, complex query logic');
        console.log('   Data: Scattered across multiple tables with poor access patterns, requires post-by-post iteration');

        const badResult = await this.relationalDAO.getUserScreenData(testUserId);
        console.log(`   Result: ${badResult.duration}ms, RCU: ${badResult.consumedCapacity?.readCapacityUnits || 'N/A'}, Data Points Fetched: ${badResult.itemCount}`);

        // Good Pattern: Single table design with main table
        console.log('\n✅ GOOD PATTERN - Single Table Design:');
        console.log('   Solution: Using main table with PK=USER#userId and single query with OR + begins_with');
        console.log('   PK: USER#userId (Partition Key) - groups all entities for a specific user');
        console.log('   SK: #ENTITY#date (Sort Key) - filtered with OR + begins_with for all entity types');
        console.log('   Cost: Single query with filter, no GSI needed - pure single table design!');
        console.log('   Data: All entity types (posts, comments, followers, likes) retrieved in one query');

        const goodResult = await this.singleTableDAO.getUserScreenData(testUserId);
        console.log(`   Result: ${goodResult.duration}ms, RCU: ${goodResult.consumedCapacity?.readCapacityUnits || 'N/A'}, Data Points Fetched: ${goodResult.itemCount}`);

        this.printComparison(badResult, goodResult);

        console.log('\n💡 Key Insight: Proper single table design demonstrates:');
        console.log('   1. Single query using PK=USER#userId with OR + begins_with for all entity types');
        console.log('   2. PK=USER#userId naturally groups all user entities together');
        console.log('   3. SK=#ENTITY#date enables efficient filtering with begins_with and OR conditions');
        console.log('   4. No GSI needed - main table handles all patterns in one query!');
    }

    // Point 5: Inefficient Access Patterns vs Strategic Design
    private async testPoint5(): Promise<void> {
        console.log('\n🔍 Point 5: Inefficient Access Patterns vs Strategic Design');
        console.log('='.repeat(60));

        // Bad Pattern: Scan operation required
        console.log('\n❌ BAD PATTERN - Relational Design:');
        console.log('   Problem: No efficient access pattern for global queries');
        console.log('   Solution: Scan operation (expensive)');
        console.log('   Cost: High RCU consumption, slow performance');
        console.log('   Data: Scans entire table to find all posts');

        const badResult = await this.relationalDAO.getAllPosts();
        console.log(`   Result: ${badResult.duration}ms, RCU: ${badResult.consumedCapacity?.readCapacityUnits || 'N/A'}, Data Points Fetched: ${badResult.itemCount}`);

        // Good Pattern: Strategic GSI usage
        console.log('\n✅ GOOD PATTERN - Single Table Design:');
        console.log('   Solution: Strategic GSI for global queries');
        console.log('   Access: Efficient query on EntityTypeIndex');
        console.log('   Cost: Lower RCU consumption, faster performance');
        console.log('   Data: Direct query for all POST entities');

        const goodResult = await this.singleTableDAO.getAllPosts();
        console.log(`   Result: ${badResult.duration}ms, RCU: ${badResult.consumedCapacity?.readCapacityUnits || 'N/A'}, Data Points Fetched: ${goodResult.itemCount}`);

        this.printComparison(badResult, goodResult);
    }



    // Point 6: GSI Overloading vs Multiple Queries
    // Demonstrates: How GSI overloading in single table design can efficiently handle infrequent access patterns
    // while relational design requires multiple queries even with GSIs
    private async testPoint6(): Promise<void> {
        console.log('\n🔍 Point 6: GSI Overloading vs Multiple Queries');
        console.log('='.repeat(60));

        const testUserId = 'user-00001';

        // Bad Pattern: Relational (multiple queries required)
        console.log('\n❌ BAD PATTERN - Relational Design:');
        console.log('   Problem: Need multiple queries to get all comments by a user');
        console.log('   1. First query: Get all posts by user (using GSI)');
        console.log('   2. Then: Query each post for comments (N+1 problem)');
        console.log('   Cost: High latency, multiple network requests, high RCU consumption');

        const badResult = await this.relationalDAO.getAllUserComments(testUserId);
        console.log(`   Result: ${badResult.duration}ms, RCU: ${badResult.consumedCapacity?.readCapacityUnits || 'N/A'}, Data Points Fetched: ${badResult.itemCount}`);

        // Good Pattern: Single Table (GSI overloading)
        console.log('\n✅ GOOD PATTERN - Single Table Design:');
        console.log('   Solution: Overload GSI1 for infrequently accessed data');
        console.log('   GSI1PK: USER_COMMENTS#userId - groups all comments by user');
        console.log('   GSI1SK: createdAt - enables date-based sorting');
        console.log('   Cost: Single query, efficient for infrequent access');

        const goodResult = await this.singleTableDAO.getAllUserComments(testUserId);
        console.log(`   Result: ${goodResult.duration}ms, RCU: ${goodResult.consumedCapacity?.readCapacityUnits || 'N/A'}, Data Points Fetched: ${goodResult.itemCount}`);

        this.printComparison(badResult, goodResult);

        console.log('\n💡 Key Insight: GSI Overloading in Single Table Design');
        console.log('   1. Use GSIs for infrequently accessed data patterns');
        console.log('   2. One GSI can serve multiple access patterns through key overloading');
        console.log('   3. Avoid GSIs for frequently accessed data (use main table)');
        console.log('   4. Even with GSIs, relational design often requires multiple queries');
    }

    private printComparison(badResult: TestResult, goodResult: TestResult): void {
        const latencyDiff = goodResult.duration - badResult.duration;
        const latencyPercent = ((latencyDiff / badResult.duration) * 100).toFixed(1);

        const rcuDiff = (goodResult.consumedCapacity?.readCapacityUnits || 0) - (badResult.consumedCapacity?.readCapacityUnits || 0);
        const rcuPercent = badResult.consumedCapacity?.readCapacityUnits ? ((rcuDiff / badResult.consumedCapacity.readCapacityUnits) * 100).toFixed(1) : 'N/A';

        console.log('\n📊 Performance Comparison:');
        console.log(`   Latency: ${latencyDiff > 0 ? 'Slower' : 'Faster'} by ${Math.abs(latencyDiff)}ms (${latencyPercent}%)`);
        console.log(`   RCU: ${rcuDiff > 0 ? 'Higher' : 'Lower'} by ${Math.abs(rcuDiff)} (${rcuPercent}%)`);
        console.log(`   Data Points Fetched:`);
        console.log(`     - Relational: ${badResult.itemCount} items`);
        console.log(`     - Single Table: ${goodResult.itemCount} items`);

        if (latencyDiff < 0 && rcuDiff < 0) {
            console.log('   🎯 Single Table Design is BETTER!');
        } else if (latencyDiff > 0 && rcuDiff > 0) {
            console.log('   ⚠️  Relational Design is BETTER (unexpected!)');
        } else {
            console.log(' Mixed results - depends on use case');
        }
    }
}