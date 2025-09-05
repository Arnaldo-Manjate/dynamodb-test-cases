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
        this.log('Starting DynamoDB Design Pattern Tests');

        try {
            if (!skipDataInsertion) {
                const hasData = await this.checkIfDataExists();
                if (!hasData) {
                    // Generate test data
                    this.log(`Generating test data: ${userCount} users, ${postCount} posts, ${commentCount} comments, ${likeCount} likes...`);
                    const testData: CompleteTestData = DataGenerator.generateTestData(
                        userCount,
                        postCount,
                        commentCount,
                        likeCount
                    );

                    // Insert data
                    this.log('💾 Inserting test data...');
                    await this.insertTestData(testData);
                } else {
                    this.log('📋 Data already exists in tables - skipping insertion');
                }
            }

            // Run all tests
            await this.testPoint1(); // Static Identifiers and Network Requests
            await this.testPoint2(); // Inefficient Access Patterns
            await this.testPoint3(); // GSI Overloading

            // Generate and save report
            await this.generateAndSaveReport();

            this.log('\n✅ All tests completed successfully!');
            this.log('📋 Check the generated report for detailed results and analysis.');

        } catch (error) {
            this.log('❌ Test execution failed: ' + error);
            throw error;
        }
    }

    // ========================================
    // DATA CLEARING FUNCTIONALITY
    // ========================================

    // Clear all data from both single table and relational tables
    async clearAllData(): Promise<void> {
        this.log('🗑️  Starting data clearing process...');

        try {
            // Clear relational tables
            this.log('  - Clearing relational tables...');
            await this.clearRelationalTables();

            // Clear single table
            this.log('  - Clearing single table...');
            await this.clearSingleTable();

            this.log('✅ All tables cleared successfully!');
        } catch (error) {
            this.log('❌ Error clearing data: ' + error);
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
            this.log(`    - Clearing table: ${tableName}`);
            await this.clearTable(tableName);
        }
    }

    private async clearSingleTable(): Promise<void> {
        this.log(`    - Clearing table: ${this.singleTableDAO.getTableName}`);
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
                this.log(`      - Found ${result.Items.length} items to delete`);

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

                this.log(`      - Deleted ${result.Items.length} items`);
            } else {
                this.log(`      - Table is already empty`);
            }
        } catch (error) {
            console.error(`      - Error clearing table ${tableName}:`, error);
            throw error;
        }
    }

    private async insertTestData(testData: CompleteTestData): Promise<void> {
        // Insert users
        this.log('  - Inserting users...');
        await this.relationalDAO.batchCreateUsers(testData.relational.users);
        await this.singleTableDAO.batchCreateItems(testData.singleTable.users);

        // Insert posts
        this.log('  - Inserting posts...');
        await this.relationalDAO.batchCreatePosts(testData.relational.posts);
        await this.singleTableDAO.batchCreateItems(testData.singleTable.posts);

        // Insert comments
        this.log('  - Inserting comments...');
        await this.relationalDAO.batchCreateComments(testData.relational.comments);
        await this.singleTableDAO.batchCreateItems(testData.singleTable.comments);

        // Insert followers
        this.log('  - Inserting followers...');
        await this.relationalDAO.batchCreateFollowers(testData.relational.followers);
        await this.singleTableDAO.batchCreateItems(testData.singleTable.followers);

        // Insert user-following relationships
        this.log('  - Inserting user-following relationships...');
        await this.relationalDAO.batchCreateUserFollowing(testData.relational.userFollowings);

        // Insert likes
        this.log('  - Inserting likes...');
        await this.relationalDAO.batchCreateLikes(testData.relational.likes);
        await this.singleTableDAO.batchCreateItems(testData.singleTable.likes);

        this.log('Data insertion complete!');
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



    // Test method for Point 1
    private async testPoint1(): Promise<void> {
        this.log('\n🔍 Point 1: Static Identifiers Enable Powerful Queries vs Multiple Network Requests');
        this.log('='.repeat(80));

        const testUserId = 'user-00001';

        // Relational Design Implementation
        this.log('\n## Relational Design');
        this.log('How it works:');
        this.log('• Stores different types of data (users, posts, comments) in separate tables');
        this.log('• To get a user\'s complete data, needs to:');
        this.log('  1. Look up the user');
        this.log('  2. Find their posts');
        this.log('  3. Find comments on each post');
        this.log('  4. Find their followers');
        this.log('  5. Find likes on each post');
        this.log('• Each lookup is a separate request to the database');
        this.log('• The more posts a user has, the more lookups needed');

        const relationalResult = await this.relationalDAO.getUserScreenData(testUserId);
        this.log(`Result: ${relationalResult.duration}ms, RCU: ${relationalResult.consumedCapacity?.readCapacityUnits || 'N/A'}, Data Points Fetched: ${relationalResult.itemCount}`);

        // Single Table Design Implementation
        this.log('\n## Single Table Design');
        this.log('Implementation: One table with composite keys');
        this.log('Query Pattern: Single query using partition and sort keys');
        this.log('Key Structure:');
        this.log('  • PK: USER#userId - Partition key groups user data');
        this.log('  • SK: #ENTITY#date - Sort key enables filtering by type');
        this.log('Data Structure: Co-located entities in single table');
        this.log('Access Pattern: One query retrieves all related data');

        const singleTableResult = await this.singleTableDAO.getUserScreenData(testUserId);
        this.log(`Result: ${singleTableResult.duration}ms, RCU: ${singleTableResult.consumedCapacity?.readCapacityUnits || 'N/A'}, Data Points Fetched: ${singleTableResult.itemCount}`);

        this.printComparison(relationalResult, singleTableResult);
    }

    // Point 2: Inefficient Access Patterns vs Strategic Design
    private async testPoint2(): Promise<void> {
        this.log('\n🔍 Point 2: Inefficient Access Patterns vs Strategic Design');
        this.log('='.repeat(60));

        // Bad Pattern: Scan operation required
        this.log('\n❌ BAD PATTERN - Relational Design:');
        this.log('   Problem: No efficient access pattern for global queries');
        this.log('   Solution: Scan operation (expensive)');
        this.log('   Cost: High RCU consumption, slow performance');
        this.log('   Data: Scans entire table to find all posts');

        const badResult = await this.relationalDAO.getAllPosts();
        this.log(`   Result: ${badResult.duration}ms, RCU: ${badResult.consumedCapacity?.readCapacityUnits || 'N/A'}, Data Points Fetched: ${badResult.itemCount}`);

        // Good Pattern: Strategic GSI usage
        this.log('\n✅ GOOD PATTERN - Single Table Design:');
        this.log('   Solution: Strategic GSI for global queries');
        this.log('   Access: Efficient query on EntityTypeIndex');
        this.log('   Cost: Lower RCU consumption, faster performance');
        this.log('   Data: Direct query for all POST entities');

        const goodResult = await this.singleTableDAO.getAllPosts();
        this.log(`   Result: ${badResult.duration}ms, RCU: ${badResult.consumedCapacity?.readCapacityUnits || 'N/A'}, Data Points Fetched: ${goodResult.itemCount}`);

        this.printComparison(badResult, goodResult);
    }



    // Point 3: GSI Overloading vs Multiple Queries
    // Demonstrates: How GSI overloading in single table design can efficiently handle infrequent access patterns
    // while relational design requires multiple queries even with GSIs
    private async testPoint3(): Promise<void> {
        this.log('\n🔍 Point 3: GSI Overloading vs Multiple Queries');
        this.log('='.repeat(60));

        const testUserId = 'user-00001';

        // Bad Pattern: Relational (multiple queries required)
        this.log('\n❌ BAD PATTERN - Relational Design:');
        this.log('   Problem: Need multiple queries to get all comments by a user');
        this.log('   1. First query: Get all posts by user (using GSI)');
        this.log('   2. Then: Query each post for comments (N+1 problem)');
        this.log('   Cost: High latency, multiple network requests, high RCU consumption');

        const badResult = await this.relationalDAO.getAllUserComments(testUserId);
        this.log(`   Result: ${badResult.duration}ms, RCU: ${badResult.consumedCapacity?.readCapacityUnits || 'N/A'}, Data Points Fetched: ${badResult.itemCount}`);

        // Good Pattern: Single Table (GSI overloading)
        this.log('\n✅ GOOD PATTERN - Single Table Design:');
        this.log('   Solution: Overload GSI1 for infrequently accessed data');
        this.log('   GSI1PK: USER_COMMENTS#userId - groups all comments by user');
        this.log('   GSI1SK: createdAt - enables date-based sorting');
        this.log('   Cost: Single query, efficient for infrequent access');

        const goodResult = await this.singleTableDAO.getAllUserComments(testUserId);
        this.log(`   Result: ${goodResult.duration}ms, RCU: ${goodResult.consumedCapacity?.readCapacityUnits || 'N/A'}, Data Points Fetched: ${goodResult.itemCount}`);

        this.printComparison(badResult, goodResult);

        this.log('\n💡 Key Insight: GSI Overloading in Single Table Design');
        this.log('   1. Use GSIs for infrequently accessed data patterns');
        this.log('   2. One GSI can serve multiple access patterns through key overloading');
        this.log('   3. Avoid GSIs for frequently accessed data (use main table)');
        this.log('   4. Even with GSIs, relational design often requires multiple queries');
    }

    private printComparison(relationalResult: TestResult, singleTableResult: TestResult): void {
        // Calculate differences (Single Table relative to Relational)
        const latencyDiff = singleTableResult.duration - relationalResult.duration;
        const latencyPercent = ((latencyDiff / relationalResult.duration) * 100).toFixed(1);
        const rcuDiff = (singleTableResult.consumedCapacity?.readCapacityUnits || 0) - (relationalResult.consumedCapacity?.readCapacityUnits || 0);
        const rcuPercent = relationalResult.consumedCapacity?.readCapacityUnits ? ((rcuDiff / relationalResult.consumedCapacity.readCapacityUnits) * 100).toFixed(1) : 'N/A';
        const itemDiff = singleTableResult.itemCount - relationalResult.itemCount;
        const itemPercent = ((itemDiff / relationalResult.itemCount) * 100).toFixed(1);

        // Data Retrieval Table
        this.log('\n### Data Retrieval\n');
        this.log('| Design | Items Fetched | Network Requests |');
        this.log('|---------|---------------|-----------------|');
        // Calculate total requests for relational design
        const relationalRequests = relationalResult.requestCount || (
            relationalResult.posts ?
                // 2 base requests (user + followers) + 1 for posts + 2 * number of posts (comments & likes per post)
                2 + 1 + (2 * (relationalResult.posts?.length || 0)) :
                1
        );
        this.log(`| Relational | ${relationalResult.itemCount} items | ${relationalRequests} requests |`);
        this.log(`| Single Table | ${singleTableResult.itemCount} items | ${singleTableResult.requestCount || 1} requests |`);

        // Performance Metrics Table
        this.log('\n### Performance Metrics\n');
        this.log('| Metric | Relational | Single Table | Difference | % Change |');
        this.log('|---------|------------|--------------|------------|----------|');
        this.log(`| Latency | ${relationalResult.duration}ms | ${singleTableResult.duration}ms | ${latencyDiff > 0 ? '+' : ''}${latencyDiff}ms | ${latencyDiff > 0 ? '+' : ''}${latencyPercent}% |`);
        this.log(`| RCU | ${relationalResult.consumedCapacity?.readCapacityUnits || 'N/A'} | ${singleTableResult.consumedCapacity?.readCapacityUnits || 'N/A'} | ${rcuDiff > 0 ? '+' : ''}${rcuDiff} | ${rcuDiff > 0 ? '+' : ''}${rcuPercent}% |`);

        // Analysis Table
        this.log('\n### Analysis\n');
        this.log('| Metric | Comparison | Details |');
        this.log('|---------|------------|----------|');

        // Latency analysis
        this.log(`| Latency | ${Math.abs(latencyDiff)}ms ${latencyDiff < 0 ? '⚡️ faster' : '🐢 slower'} | Single Table has ${Math.abs(Number(latencyPercent))}% ${latencyDiff < 0 ? 'lower' : 'higher'} latency |`);

        // RCU analysis
        this.log(`| RCU | ${Math.abs(rcuDiff)} ${rcuDiff < 0 ? '📉 fewer' : '📈 more'} | Single Table uses ${Math.abs(Number(rcuPercent))}% ${rcuDiff < 0 ? 'fewer' : 'more'} RCUs |`);

        // Overall assessment
        if (latencyDiff < 0 && rcuDiff < 0) {
            this.log(`| Overall | 🎯 Performance | Single Table shows lower latency and RCU usage |`);
        } else if (latencyDiff > 0 && rcuDiff > 0) {
            this.log(`| Overall | 🎯 Performance | Relational shows lower latency and RCU usage |`);
        } else {
            this.log(`| Overall | ⚖️ Trade-off | Mixed results between latency and RCU usage |`);
        }
    }

    private testOutput: string[] = [];

    private log(message: string): void {
        this.testOutput.push(message);

    }

    private async generateMarkdownReport(): Promise<string> {
        let report = '# DynamoDB Design Pattern Tests\n\n';
        report += '## Test Environment\n\n';
        report += `- **Region**: us-east-1\n`;
        report += `- **Timestamp**: ${new Date().toISOString()}\n\n`;

        // Split the output into test points
        const points = this.testOutput.join('\n').split('🔍 Point');

        // Skip the first element (it's the header)
        for (let i = 1; i < points.length; i++) {
            const point = points[i];
            report += `## Point ${point}\n\n`;
        }

        return report;
    }

    private async saveMarkdownReport(report: string): Promise<void> {
        const fs = require('fs');
        const path = require('path');
        const reportPath = path.join(__dirname, '..', '..', 'results.md');

        fs.writeFileSync(reportPath, report);
        this.log(`Report saved to: ${reportPath}`);
    }

    public async generateAndSaveReport(): Promise<void> {
        const report = await this.generateMarkdownReport();
        await this.saveMarkdownReport(report);
    }
}