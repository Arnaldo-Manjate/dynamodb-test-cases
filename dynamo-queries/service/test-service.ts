import { RelationalDAO } from '../dao/relational-dao';
import { SingleTableDAO } from '../dao/single-table-dao';
import { DataGenerator } from './data-generator';
import { TestResult, CompleteTestData } from '../@types';

export class TestService {
    private relationalDAO: RelationalDAO;
    private singleTableDAO: SingleTableDAO;

    constructor(region: string = 'us-east-1') {
        this.relationalDAO = new RelationalDAO('users-relational', 'posts-relational', region);
        this.singleTableDAO = new SingleTableDAO('single-table-social', region);
    }

    async runAllTests(userCount: number = 5, postCount: number = 20, skipDataInsertion: boolean = false): Promise<void> {
        console.log('Starting DynamoDB Design Pattern Tests');

        try {
            if (!skipDataInsertion) {
                // Check if data already exists
                const hasData = await this.checkIfDataExists();

                if (false) {
                    console.log('📋 Data already exists in tables - skipping insertion');
                } else {
                    // Generate test data
                    console.log(`Generating test data: ${userCount} users, ${postCount} posts...`);
                    const testData: CompleteTestData = DataGenerator.generateTestData(userCount, postCount);

                    // Log the generated data counts
                    console.log('📊 Generated Data Counts:');
                    console.log(`   - Relational Users: ${testData.relational.users.length}`);
                    console.log(`   - Relational Posts: ${testData.relational.posts.length}`);
                    console.log(`   - Single Table Users: ${testData.singleTable.users.length}`);
                    console.log(`   - Single Table Posts: ${testData.singleTable.posts.length}`);

                    // Insert data
                    console.log('💾 Inserting test data...');
                    await this.insertTestData(testData);
                }
            } else {
                console.log('📋 Skipping data insertion - using existing data');
            }

            await this.testPoint1();
            await this.testPoint2();
            await this.testPoint3();
            await this.testPoint4();
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

    private async insertTestData(testData: CompleteTestData): Promise<void> {
        // Insert users
        console.log('  - Inserting users...');
        await this.relationalDAO.batchCreateUsers(testData.relational.users);
        await this.singleTableDAO.batchCreateItems(testData.singleTable.users);

        // Insert posts
        console.log('  - Inserting posts...');
        await this.relationalDAO.batchCreatePosts(testData.relational.posts);
        await this.singleTableDAO.batchCreateItems(testData.singleTable.posts);

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

    // Point 3: GSI Necessity vs Strategic GSI Usage
    private async testPoint3(): Promise<void> {
        console.log('\n🔍 Point 3: GSI Necessity vs Strategic GSI Usage');
        console.log('='.repeat(60));

        const testUserId = 'user-00001';
        const startDate = '2024-01-01';
        const endDate = '2024-12-31';

        // Bad Pattern: Forced GSI usage
        console.log('\n❌ BAD PATTERN - Relational Design:');
        console.log('   Problem: Missing sort key forces GSI creation');
        console.log('   GSI: PostsByDateIndex (required for date queries)');
        console.log('   Cost: Additional storage and RCU consumption');

        const badResult = await this.relationalDAO.getPostsByDateRange(testUserId, startDate, endDate);
        console.log(`   Result: ${badResult.duration}ms, RCU: ${badResult.consumedCapacity?.readCapacityUnits || 'N/A'}, Data Points Fetched: ${badResult.itemCount}`);

        // Good Pattern: Strategic GSI usage
        console.log('\n✅ GOOD PATTERN - Single Table Design:');
        console.log('   Solution: Sort key enables efficient date range queries');
        console.log('   GSI: Only needed for infrequently accessed patterns');
        console.log('   Cost: Lower storage and RCU consumption');

        const goodResult = await this.singleTableDAO.getPostsByDateRange(testUserId, startDate, endDate);
        console.log(`   Result: ${goodResult.duration}ms, RCU: ${goodResult.consumedCapacity?.readCapacityUnits || 'N/A'}, Data Points Fetched: ${goodResult.itemCount}`);

        this.printComparison(badResult, goodResult);
    }

    // Point 4: GSI Naming Anti-patterns vs Generic Names
    private async testPoint4(): Promise<void> {
        console.log('\n🔍 Point 4: GSI Naming Anti-patterns vs Generic Names');
        console.log('='.repeat(60));

        const testUserId = 'user-00001';

        // Bad Pattern: Descriptive GSI names
        console.log('\n❌ BAD PATTERN - Relational Design:');
        console.log('   GSI Names: PostsByDateIndex, CommentsByPostIndex');
        console.log('   Problem: Names reveal implementation details');
        console.log('   Maintenance: Harder to refactor and maintain');

        const badResult = await this.relationalDAO.getUserPostsWithGSI(testUserId);
        console.log(`   Result: ${badResult.duration}ms, RCU: ${badResult.consumedCapacity?.readCapacityUnits || 'N/A'}, Data Points Fetched: ${badResult.itemCount}`);

        // Good Pattern: Generic GSI names
        console.log('\n✅ GOOD PATTERN - Single Table Design:');
        console.log('   GSI Names: EntityTypeIndex, DateIndex');
        console.log('   Solution: Generic names hide implementation details');
        console.log('   Maintenance: Easier to refactor and maintain');

        const goodResult = await this.singleTableDAO.getUserPostsWithGSI(testUserId);
        console.log(`   Result: ${goodResult.duration}ms, RCU: ${goodResult.consumedCapacity?.readCapacityUnits || 'N/A'}, Data Points Fetched: ${goodResult.itemCount}`);

        this.printComparison(badResult, goodResult);
    }

    // Point 5: Multiple Queries vs Single Query Efficiency
    private async testPoint5(): Promise<void> {
        console.log('\n🔍 Point 5: Multiple Queries vs Single Query Efficiency');
        console.log('='.repeat(60));

        const testUserId = 'user-00001';

        // Bad Pattern: Multiple queries required
        console.log('\n❌ BAD PATTERN - Relational Design:');
        console.log('   Problem: Need multiple queries to get user + posts');
        console.log('   Queries: 1 for user + 1 for posts');
        console.log('   Cost: Higher latency, more RCU consumption');
        console.log('   Data: User (1 item) + Posts (multiple items)');

        const badResult = await this.relationalDAO.getUserWithPosts(testUserId);
        console.log(`   Result: ${badResult.duration}ms, RCU: ${badResult.consumedCapacity?.readCapacityUnits || 'N/A'}, Data Points Fetched: ${badResult.itemCount}`);

        // Good Pattern: Single efficient query
        console.log('\n✅ GOOD PATTERN - Single Table Design:');
        console.log('   Solution: Single query gets user + all posts');
        console.log('   Queries: 1 total');
        console.log('   Cost: Lower latency, less RCU consumption');
        console.log('   Data: User + Posts in single result set');

        const goodResult = await this.singleTableDAO.getUserWithPosts(testUserId);
        console.log(`   Result: ${goodResult.duration}ms, RCU: ${goodResult.consumedCapacity?.readCapacityUnits || 'N/A'}, Data Points Fetched: ${goodResult.itemCount}`);

        this.printComparison(badResult, goodResult);
    }

    // Point 6: Inefficient Access Patterns vs Strategic Design
    private async testPoint6(): Promise<void> {
        console.log('\n🔍 Point 6: Inefficient Access Patterns vs Strategic Design');
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
        console.log(`   Result: ${goodResult.duration}ms, RCU: ${goodResult.consumedCapacity?.readCapacityUnits || 'N/A'}, Data Points Fetched: ${goodResult.itemCount}`);

        this.printComparison(badResult, goodResult);
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
            console.log('   ⚖️  Mixed results - depends on use case');
        }
    }
} 