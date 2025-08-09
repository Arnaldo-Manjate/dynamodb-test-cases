import { RelationalDAO } from "../dao/relational-dao";
import { SingleTableDAO } from "../dao/single-table-dao";
import { DataGenerator } from "../utilities/data-generator";
import { TestResult } from "../types";
import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';
import * as https from 'https';
import * as http from 'http';

interface NetworkInfo {
    country: string;
    city?: string;
    isp?: string;
    downloadSpeed?: number;
    uploadSpeed?: number;
    latency?: number;
    timestamp: string;
}

export default class TestRunner {
    private relationalDAO: RelationalDAO;
    private singleTableDAO: SingleTableDAO;
    private results: TestResult[] = [];
    private region: string;
    private networkInfo: NetworkInfo | null = null;
    private config: {
        userCount: number;
        orderCount: number;
        testUserCount: number;
    };

    constructor(config?: {
        userCount?: number;
        orderCount?: number;
        testUserCount?: number;
    }) {
        // Get region from environment or default to us-east-1
        this.region = process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || 'us-east-1';

        // Set default configuration
        this.config = {
            userCount: config?.userCount ?? 10,
            orderCount: config?.orderCount ?? 50000,
            testUserCount: config?.testUserCount ?? 10
        };

        console.info(` Running tests in AWS Region: ${this.region}`);
        console.info(`AWS Account: ${process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT || 'Not configured'}`);
        console.info(`Test Configuration:`);
        console.info(`  - Total Users: ${this.config.userCount.toLocaleString()}`);
        console.info(`  - Total Orders: ${this.config.orderCount.toLocaleString()}`);
        console.info(`  - Test Users: ${this.config.testUserCount}`);

        // initialize DAOs
        this.relationalDAO = new RelationalDAO(
            'users-table-relational',
            'orders-table-relational',
            this.region
        );
        this.singleTableDAO = new SingleTableDAO('single-table-design', this.region);
    }

    private async getNetworkInfo(): Promise<NetworkInfo> {
        try {
            console.info('  🌐 Gathering network information...');

            // Get IP and location info
            const ipInfo = await this.getIPInfo();

            const networkInfo: NetworkInfo = {
                country: ipInfo.country || 'Unknown',
                city: ipInfo.city,
                isp: ipInfo.isp,
                downloadSpeed: undefined, // Remove unreliable speed test
                uploadSpeed: undefined,   // Remove unreliable speed test
                latency: undefined,       // Remove unreliable latency test
                timestamp: new Date().toISOString()
            };

            console.info(`  📍 Location: ${networkInfo.city || 'Unknown'}, ${networkInfo.country}`);
            console.info(`  🏢 ISP: ${networkInfo.isp || 'Unknown'}`);
            console.info(`  🕐 Test Timestamp: ${networkInfo.timestamp}`);

            return networkInfo;
        } catch (error) {
            console.warn('  ⚠️  Could not gather network information:', error);
            return {
                country: 'Unknown',
                timestamp: new Date().toISOString()
            };
        }
    }

    private async getIPInfo(): Promise<any> {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'ipapi.co',
                path: '/json/',
                method: 'GET',
                timeout: 5000
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('IP info request timeout'));
            });

            req.end();
        });
    }

    async runAllTests(): Promise<void> {
        console.info('🚀 Starting DynamoDB Performance Tests...\n');

        try {
            // Get network information
            this.networkInfo = await this.getNetworkInfo();

            // generate test data
            console.info('Generating test data...');
            const testData = DataGenerator.generateTestData(this.config.userCount, this.config.orderCount);

            // insert data into tables
            console.info('Inserting data into tables...');
            await this.insertTestData(testData);

            // run performance tests
            console.info('Running performance tests...');
            await this.runPerformanceTests(testData);

            // generate report
            console.info('Generating performance report...');
            await this.generateReport();

            console.info('✅All tests completed successfully!');

        } catch (error) {
            console.error(' Test execution failed:', error);
            if (error instanceof Error && error.message.includes('credentials')) {
                console.error('\n💡 AWS Credentials Issue Detected!');
                console.error('Please configure your AWS credentials:');
                console.error('aws configure');
                console.error('or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables');
            }
            throw error;
        }
    }

    async runReportOnly(): Promise<void> {
        console.info('📊 Starting DynamoDB Performance Report Generation...\n');

        try {
            // Get network information
            this.networkInfo = await this.getNetworkInfo();

            // Generate minimal test data for 10 users
            console.info('Generating minimal test data for performance tests...');
            const testData = DataGenerator.generateMinimalReportTestData();

            // run performance tests (assumes data already exists)
            console.info('Running performance tests on existing data...');
            await this.runPerformanceTests(testData);

            // generate report
            console.info('Generating performance report...');
            await this.generateReport();

            console.info('✅ Report generation completed successfully!');

        } catch (error) {
            console.error(' Test execution failed:', error);
            if (error instanceof Error && error.message.includes('credentials')) {
                console.error('\n💡 AWS Credentials Issue Detected!');
                console.error('Please configure your AWS credentials:');
                console.error('aws configure');
                console.error('or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables');
            }
            throw error;
        }
    }

    private async insertTestData(testData: any): Promise<void> {
        console.info('  Checking current table counts and inserting missing data...');

        // Check current counts
        const usersCount = await this.relationalDAO.getTableItemCount();
        const ordersCount = await this.relationalDAO.getOrdersTableItemCount();
        const singleTableCount = await this.singleTableDAO.getTableItemCount();

        console.info(`  Current counts:`);
        console.info(`    Users table: ${usersCount.toLocaleString()} items`);
        console.info(`    Orders table: ${ordersCount.toLocaleString()} items`);
        console.info(`    Single table: ${singleTableCount.toLocaleString()} items`);

        const requiredUsers = this.config.userCount;
        const requiredOrders = this.config.orderCount;
        const requiredSingleTableItems = this.config.userCount + this.config.orderCount;

        // Insert users if needed
        if (usersCount < requiredUsers) {
            const usersToInsert = requiredUsers - usersCount;
            console.info(`  - Inserting ${usersToInsert} users into relational table...`);
            const usersToAdd = testData?.users?.slice(0, usersToInsert) ?? [];
            await this.relationalDAO.batchCreateUsers(usersToAdd);
        } else {
            console.info(`  - Users table has sufficient data (${usersCount} >= ${requiredUsers})`);
        }

        // Insert orders if needed
        if (ordersCount < requiredOrders) {
            const ordersToInsert = requiredOrders - ordersCount;
            console.info(`  - Inserting ${ordersToInsert.toLocaleString()} orders into relational table...`);
            const ordersToAdd = testData?.orders?.slice(0, ordersToInsert) ?? [];
            await this.relationalDAO.batchCreateOrders(ordersToAdd);
        } else {
            console.info(`  - Orders table has sufficient data (${ordersCount} >= ${requiredOrders})`);
        }

        // Insert single table items if needed
        if (singleTableCount < requiredSingleTableItems) {
            const itemsToInsert = requiredSingleTableItems - singleTableCount;
            console.info(`  - Inserting ${itemsToInsert.toLocaleString()} items into single table...`);
            const singleTableItems = [...(testData?.singleTableUsers ?? []), ...(testData?.singleTableOrders ?? [])];
            const itemsToAdd = singleTableItems.slice(0, itemsToInsert);
            await this.singleTableDAO.batchCreateItems(itemsToAdd);
        } else {
            console.info(`  - Single table has sufficient data (${singleTableCount} >= ${requiredSingleTableItems})`);
        }

        console.info('  Data insertion check complete!');

        // Log final table metrics
        console.info('  Final table metrics:');
        await this.relationalDAO.logTableItemCount();
        await this.relationalDAO.logOrdersTableItemCount();
        await this.singleTableDAO.logTableItemCount();
    }

    private async runPerformanceTests(testData: any): Promise<void> {
        // Use configured number of test users
        const testUsers = testData?.users ?? [];
        const testSingleTableUsers = testData?.singleTableUsers ?? [];

        console.info(`  Testing ${testUsers.length} users for relational design...`);
        for (const user of testUsers) {
            console.info(`  - Testing relational user: ${user.userId}`);

            // Relational Design Tests
            const relationalTests = await this.runRelationalTests(user);
            this.results.push(...relationalTests);
        }

        console.info(`  Testing ${testSingleTableUsers.length} users for single table design...`);
        for (const user of testSingleTableUsers) {
            console.info(`  - Testing single table user: ${user.userId}`);

            // Single Table Design Tests
            const singleTableTests = await this.runSingleTableTests(user);
            this.results.push(...singleTableTests);
        }
    }

    private async runRelationalTests(user: any): Promise<TestResult[]> {
        const results: TestResult[] = [];

        // Test 1: Get specific order (GetItem)
        results.push(await this.relationalDAO.getOrder(user.userId, 'order-00000001'));

        // Test 2: Get user orders (Query without GSI)
        results.push(await this.relationalDAO.getUserOrders(user.userId));

        // Test 3: Get user orders using GSI
        results.push(await this.relationalDAO.getUserOrdersWithGSI(user.userId));

        return results;
    }

    private async runSingleTableTests(user: any): Promise<TestResult[]> {
        const results: TestResult[] = [];

        // Test 1: Get specific order (Query)
        results.push(await this.singleTableDAO.getOrder(user.userId, 'order-00000001'));

        // Test 2: Get user orders (Query without GSI)
        results.push(await this.singleTableDAO.getUserOrders(user.userId));

        // Test 3: Get user orders using GSI
        results.push(await this.singleTableDAO.getUserOrdersWithGSI(user.userId));

        return results;
    }

    private async generateReport(): Promise<void> {
        const report = this.createPerformanceReport();

        // Add network information to the results
        const resultsWithNetwork = {
            networkInfo: this.networkInfo,
            results: this.results,
            summary: report.summary,
            performance: report.performance
        };

        // Save detailed results in dynamo-tests folder
        const resultsPath = path.join(__dirname, '..', 'test-results.json');
        fs.writeFileSync(resultsPath, JSON.stringify(resultsWithNetwork, null, 2));

        // Generate markdown report in dynamo-tests folder
        const markdownReport = this.generateMarkdownReport(report);
        const reportPath = path.join(__dirname, '..', 'results.md');
        fs.writeFileSync(reportPath, markdownReport);

        console.log('  📄 Reports generated: test-results.json and results.md');
        console.log(`  📁 Files saved in: ${path.dirname(reportPath)}`);
    }

    private createPerformanceReport(): any {
        // Filter out BatchWrite operations - focus only on query performance
        const queryResults = this.results.filter(r => r.operation !== 'BatchWrite');
        const relationalResults = queryResults.filter(r => r.design === 'Relational');
        const singleTableResults = queryResults.filter(r => r.design === 'SingleTable');

        // Find fastest and slowest requests
        const allSuccessfulResults = queryResults.filter(r => r.success);
        const fastestRequest = allSuccessfulResults.reduce((fastest, current) =>
            current.duration < fastest.duration ? current : fastest, allSuccessfulResults[0]);
        const slowestRequest = allSuccessfulResults.reduce((slowest, current) =>
            current.duration > slowest.duration ? current : slowest, allSuccessfulResults[0]);

        // Calculate GSI performance metrics
        const gsiResults = queryResults.filter(r => r.usedGSI && r.success);
        const nonGsiResults = queryResults.filter(r => !r.usedGSI && r.success);

        const gsiPerformance = {
            withGSI: {
                averageLatency: this.calculateAverageLatency(gsiResults),
                totalRCU: gsiResults.reduce((sum, r) => sum + (r.rcuConsumed || 0), 0),
                operationCount: gsiResults.length
            },
            withoutGSI: {
                averageLatency: this.calculateAverageLatency(nonGsiResults),
                totalRCU: nonGsiResults.reduce((sum, r) => sum + (r.rcuConsumed || 0), 0),
                operationCount: nonGsiResults.length
            },
            improvement: 0
        };

        if (gsiPerformance.withoutGSI.averageLatency > 0) {
            gsiPerformance.improvement = ((gsiPerformance.withoutGSI.averageLatency - gsiPerformance.withGSI.averageLatency) / gsiPerformance.withoutGSI.averageLatency) * 100;
        }

        // Calculate cost breakdown (read operations only)
        const totalRCU = queryResults.reduce((sum, r) => sum + (r.rcuConsumed || 0), 0);
        const totalCost = queryResults.reduce((sum, r) => sum + (r.estimatedCost || 0), 0);

        // Calculate timing percentiles
        const sortedDurations = allSuccessfulResults.map(r => r.duration).sort((a, b) => a - b);
        const timingDistribution = {
            p50: this.getPercentile(sortedDurations, 50),
            p90: this.getPercentile(sortedDurations, 90),
            p95: this.getPercentile(sortedDurations, 95),
            p99: this.getPercentile(sortedDurations, 99)
        };

        return {
            summary: {
                totalTests: queryResults.length,
                successfulTests: queryResults.filter(r => r.success).length,
                failedTests: queryResults.filter(r => !r.success).length,
                region: this.region,
                timestamp: new Date().toISOString()
            },
            relational: {
                averageLatency: this.calculateAverageLatency(relationalResults),
                totalOperations: relationalResults.length,
                operationsByType: this.groupByOperation(relationalResults),
                totalRCU: relationalResults.reduce((sum, r) => sum + (r.rcuConsumed || 0), 0),
                totalCost: relationalResults.reduce((sum, r) => sum + (r.estimatedCost || 0), 0)
            },
            singleTable: {
                averageLatency: this.calculateAverageLatency(singleTableResults),
                totalOperations: singleTableResults.length,
                operationsByType: this.groupByOperation(singleTableResults),
                totalRCU: singleTableResults.reduce((sum, r) => sum + (r.rcuConsumed || 0), 0),
                totalCost: singleTableResults.reduce((sum, r) => sum + (r.estimatedCost || 0), 0)
            },
            comparison: {
                latencyImprovement: this.calculateLatencyImprovement(),
                efficiencyGain: this.calculateEfficiencyGain()
            },
            performance: {
                fastestRequest,
                slowestRequest,
                gsiPerformance,
                timingDistribution,
                costBreakdown: {
                    readCost: (totalRCU / 1000000) * 0.25,
                    totalCost
                }
            }
        };
    }

    private calculateAverageLatency(results: TestResult[]): number {
        if (results.length === 0) return 0;
        const totalLatency = results.reduce((sum, r) => sum + r.duration, 0);
        return totalLatency / results.length;
    }

    private groupByOperation(results: TestResult[]): Record<string, TestResult[]> {
        return results.reduce((groups, result) => {
            // Group by test name instead of operation type for more accurate reporting
            const key = result.testName;
            if (!groups[key]) groups[key] = [];
            groups[key].push(result);
            return groups;
        }, {} as Record<string, TestResult[]>);
    }

    private calculateLatencyImprovement(): number {
        const relationalAvg = this.calculateAverageLatency(
            this.results.filter(r => r.design === 'Relational')
        );
        const singleTableAvg = this.calculateAverageLatency(
            this.results.filter(r => r.design === 'SingleTable')
        );

        if (relationalAvg === 0) return 0;
        return ((relationalAvg - singleTableAvg) / relationalAvg) * 100;
    }

    private calculateEfficiencyGain(): number {
        const relationalTests = this.results.filter(r => r.design === 'Relational');
        const singleTableTests = this.results.filter(r => r.design === 'SingleTable');

        const relationalQueries = relationalTests.filter(r => r.operation === 'Query').length;
        const singleTableQueries = singleTableTests.filter(r => r.operation === 'Query').length;

        if (relationalQueries === 0) return 0;
        return ((relationalQueries - singleTableQueries) / relationalQueries) * 100;
    }

    // Helper methods for report generation
    private getAverageLatencyByOperation(operationsByType: any, operationType: string): number {
        const operations = operationsByType[operationType] || [];
        if (operations.length === 0) return 0;
        return operations.reduce((sum: number, op: any) => sum + op.duration, 0) / operations.length;
    }

    private getRCUByOperation(operationsByType: any, operationType: string): number {
        const operations = operationsByType[operationType] || [];
        if (operations.length === 0) return 0;
        return operations.reduce((sum: number, op: any) => sum + (op.rcuConsumed || 0), 0) / operations.length;
    }

    private getRecordCountByOperation(operationsByType: any, operationType: string): number {
        const operations = operationsByType[operationType] || [];
        if (operations.length === 0) return 0;
        return operations.reduce((sum: number, op: any) => sum + (op.recordCount || 0), 0) / operations.length;
    }

    private getLatencyPerRecord(operationsByType: any, operationType: string): number {
        const operations = operationsByType[operationType] || [];
        if (operations.length === 0) return 0;

        const totalLatency = operations.reduce((sum: number, op: any) => sum + op.duration, 0);
        const totalRecords = operations.reduce((sum: number, op: any) => sum + (op.recordCount || 0), 0);

        return totalRecords > 0 ? totalLatency / totalRecords : 0;
    }

    private getLatencyDifferencePercentage(relationalOps: any, relOpType: string, singleTableOps: any, singleOpType: string): string {
        const relationalLatency = this.getAverageLatencyByOperation(relationalOps, relOpType);
        const singleTableLatency = this.getAverageLatencyByOperation(singleTableOps, singleOpType);

        if (relationalLatency === 0) return 'N/A';

        const difference = ((relationalLatency - singleTableLatency) / relationalLatency) * 100;
        return difference > 0 ? `${difference.toFixed(1)}% faster` : `${Math.abs(difference).toFixed(1)}% slower`;
    }

    private getRCUDifferencePercentage(relationalOps: any, relOpType: string, singleTableOps: any, singleOpType: string): string {
        const relationalRCU = this.getRCUByOperation(relationalOps, relOpType);
        const singleTableRCU = this.getRCUByOperation(singleTableOps, singleOpType);

        if (relationalRCU === 0) return 'N/A';

        const difference = ((relationalRCU - singleTableRCU) / relationalRCU) * 100;
        return difference > 0 ? `${difference.toFixed(1)}% less` : `${Math.abs(difference).toFixed(1)}% more`;
    }

    private generateMarkdownReport(report: any): string {
        const networkSection = this.networkInfo ? `
## Network Information
- **Location**: ${this.networkInfo.city || 'Unknown'}, ${this.networkInfo.country}
- **ISP**: ${this.networkInfo.isp || 'Unknown'}
- **Test Timestamp**: ${this.networkInfo.timestamp}
` : '';

        return `# DynamoDB Performance Test Results

## Test Overview
- **Total Tests**: ${report.summary.totalTests} (6 functions: 3 per design)
- **Successful Tests**: ${report.summary.successfulTests}
- **Failed Tests**: ${report.summary.failedTests}
- **AWS Region**: ${report.summary.region}
- **Test Timestamp**: ${report.summary.timestamp}
- **Users Tested**: ${this.config.userCount} users (user-00001 to user-${this.config.userCount.toString().padStart(5, '0')})
- **Orders Generated**: ${this.config.orderCount.toLocaleString()} orders randomly distributed among test users${networkSection}

## Test Functions

### Relational Design
1. **GetOrder** - GetItem operation (userId + orderId)
2. **GetUserOrders** - Query operation (userId as partition key)
3. **GetUserOrdersWithGSI** - Query operation using OrderIdIndex GSI (userId as PK)

### Single Table Design
1. **GetOrder** - Query operation (PK/SK pattern)
2. **GetUserOrders** - Query operation (PK pattern)
3. **GetUserOrdersWithGSI** - Query operation using EntityTypeIndex GSI

## Performance Results

### Latency Comparison
| Function | Relational (ms) | Single Table (ms) | Difference |
|----------|-----------------|-------------------|------------|
| GetOrder | ${this.getAverageLatencyByOperation(report.relational.operationsByType, 'GetOrder').toFixed(2)} | ${this.getAverageLatencyByOperation(report.singleTable.operationsByType, 'GetOrder').toFixed(2)} | ${this.getLatencyDifferencePercentage(report.relational.operationsByType, 'GetOrder', report.singleTable.operationsByType, 'GetOrder')} |
| GetUserOrders | ${this.getAverageLatencyByOperation(report.relational.operationsByType, 'GetUserOrders').toFixed(2)} | ${this.getAverageLatencyByOperation(report.singleTable.operationsByType, 'GetUserOrders').toFixed(2)} | ${this.getLatencyDifferencePercentage(report.relational.operationsByType, 'GetUserOrders', report.singleTable.operationsByType, 'GetUserOrders')} |
| GetUserOrdersWithGSI | ${this.getAverageLatencyByOperation(report.relational.operationsByType, 'GetUserOrdersWithGSI').toFixed(2)} | ${this.getAverageLatencyByOperation(report.singleTable.operationsByType, 'GetUserOrdersWithGSI').toFixed(2)} | ${this.getLatencyDifferencePercentage(report.relational.operationsByType, 'GetUserOrdersWithGSI', report.singleTable.operationsByType, 'GetUserOrdersWithGSI')} |

### RCU Consumption
| Function | Relational RCU | Single Table RCU | Difference |
|----------|----------------|------------------|------------|
| GetOrder | ${this.getRCUByOperation(report.relational.operationsByType, 'GetOrder').toFixed(2)} | ${this.getRCUByOperation(report.singleTable.operationsByType, 'GetOrder').toFixed(2)} | ${this.getRCUDifferencePercentage(report.relational.operationsByType, 'GetOrder', report.singleTable.operationsByType, 'GetOrder')} |
| GetUserOrders | ${this.getRCUByOperation(report.relational.operationsByType, 'GetUserOrders').toFixed(2)} | ${this.getRCUByOperation(report.singleTable.operationsByType, 'GetUserOrders').toFixed(2)} | ${this.getRCUDifferencePercentage(report.relational.operationsByType, 'GetUserOrders', report.singleTable.operationsByType, 'GetUserOrders')} |
| GetUserOrdersWithGSI | ${this.getRCUByOperation(report.relational.operationsByType, 'GetUserOrdersWithGSI').toFixed(2)} | ${this.getRCUByOperation(report.singleTable.operationsByType, 'GetUserOrdersWithGSI').toFixed(2)} | ${this.getRCUDifferencePercentage(report.relational.operationsByType, 'GetUserOrdersWithGSI', report.singleTable.operationsByType, 'GetUserOrdersWithGSI')} |

### Record Counts per Operation
| Function | Relational Records | Single Table Records |
|----------|-------------------|---------------------|
| GetOrder | ${this.getRecordCountByOperation(report.relational.operationsByType, 'GetOrder')} | ${this.getRecordCountByOperation(report.singleTable.operationsByType, 'GetOrder')} |
| GetUserOrders | ${this.getRecordCountByOperation(report.relational.operationsByType, 'GetUserOrders')} | ${this.getRecordCountByOperation(report.singleTable.operationsByType, 'GetUserOrders')} |
| GetUserOrdersWithGSI | ${this.getRecordCountByOperation(report.relational.operationsByType, 'GetUserOrdersWithGSI')} | ${this.getRecordCountByOperation(report.singleTable.operationsByType, 'GetUserOrdersWithGSI')} |

### Performance per Record
| Function | Relational (ms/record) | Single Table (ms/record) |
|----------|------------------------|--------------------------|
| GetOrder | ${this.getLatencyPerRecord(report.relational.operationsByType, 'GetOrder').toFixed(4)} | ${this.getLatencyPerRecord(report.singleTable.operationsByType, 'GetOrder').toFixed(4)} |
| GetUserOrders | ${this.getLatencyPerRecord(report.relational.operationsByType, 'GetUserOrders').toFixed(4)} | ${this.getLatencyPerRecord(report.singleTable.operationsByType, 'GetUserOrders').toFixed(4)} |
| GetUserOrdersWithGSI | ${this.getLatencyPerRecord(report.relational.operationsByType, 'GetUserOrdersWithGSI').toFixed(4)} | ${this.getLatencyPerRecord(report.singleTable.operationsByType, 'GetUserOrdersWithGSI').toFixed(4)} |

## GSI vs Non-GSI Performance Comparison

### Relational Design: GetUserOrders vs GetUserOrdersWithGSI
| Metric | Without GSI | With GSI | Difference |
|--------|-------------|----------|------------|
| Average Latency | ${this.getAverageLatencyByOperation(report.relational.operationsByType, 'GetUserOrders').toFixed(2)}ms | ${this.getAverageLatencyByOperation(report.relational.operationsByType, 'GetUserOrdersWithGSI').toFixed(2)}ms | ${this.getLatencyDifferencePercentage(report.relational.operationsByType, 'GetUserOrders', report.relational.operationsByType, 'GetUserOrdersWithGSI')} |
| Average RCU | ${this.getRCUByOperation(report.relational.operationsByType, 'GetUserOrders').toFixed(2)} | ${this.getRCUByOperation(report.relational.operationsByType, 'GetUserOrdersWithGSI').toFixed(2)} | ${this.getRCUDifferencePercentage(report.relational.operationsByType, 'GetUserOrders', report.relational.operationsByType, 'GetUserOrdersWithGSI')} |

### Single Table Design: GetUserOrders vs GetUserOrdersWithGSI
| Metric | Without GSI | With GSI | Difference |
|--------|-------------|----------|------------|
| Average Latency | ${this.getAverageLatencyByOperation(report.singleTable.operationsByType, 'GetUserOrders').toFixed(2)}ms | ${this.getAverageLatencyByOperation(report.singleTable.operationsByType, 'GetUserOrdersWithGSI').toFixed(2)}ms | ${this.getLatencyDifferencePercentage(report.singleTable.operationsByType, 'GetUserOrders', report.singleTable.operationsByType, 'GetUserOrdersWithGSI')} |
| Average RCU | ${this.getRCUByOperation(report.singleTable.operationsByType, 'GetUserOrders').toFixed(2)} | ${this.getRCUByOperation(report.singleTable.operationsByType, 'GetUserOrdersWithGSI').toFixed(2)} | ${this.getRCUDifferencePercentage(report.singleTable.operationsByType, 'GetUserOrders', report.singleTable.operationsByType, 'GetUserOrdersWithGSI')} |

## Performance Graphs

### 1. Latency Comparison
\`\`\`mermaid
graph LR
    subgraph "GetOrder Latency"
        R1[Relational<br/>${this.getAverageLatencyByOperation(report.relational.operationsByType, 'GetOrder').toFixed(2)}ms<br/>(${this.getRecordCountByOperation(report.relational.operationsByType, 'GetOrder')} records)]
        S1[Single Table<br/>${this.getAverageLatencyByOperation(report.singleTable.operationsByType, 'GetOrder').toFixed(2)}ms<br/>(${this.getRecordCountByOperation(report.singleTable.operationsByType, 'GetOrder')} records)]
    end
    
    subgraph "GetUserOrders Latency"
        R2[Relational<br/>${this.getAverageLatencyByOperation(report.relational.operationsByType, 'GetUserOrders').toFixed(2)}ms<br/>(${this.getRecordCountByOperation(report.relational.operationsByType, 'GetUserOrders')} records)]
        S2[Single Table<br/>${this.getAverageLatencyByOperation(report.singleTable.operationsByType, 'GetUserOrders').toFixed(2)}ms<br/>(${this.getRecordCountByOperation(report.singleTable.operationsByType, 'GetUserOrders')} records)]
    end
    
    subgraph "GetUserOrdersWithGSI Latency"
        R3[Relational<br/>${this.getAverageLatencyByOperation(report.relational.operationsByType, 'GetUserOrdersWithGSI').toFixed(2)}ms<br/>(${this.getRecordCountByOperation(report.relational.operationsByType, 'GetUserOrdersWithGSI')} records)]
        S3[Single Table<br/>${this.getAverageLatencyByOperation(report.singleTable.operationsByType, 'GetUserOrdersWithGSI').toFixed(2)}ms<br/>(${this.getRecordCountByOperation(report.singleTable.operationsByType, 'GetUserOrdersWithGSI')} records)]
    end
\`\`\`

### 2. RCU Consumption
\`\`\`mermaid
graph LR
    subgraph "GetOrder RCU"
        R1[Relational<br/>${this.getRCUByOperation(report.relational.operationsByType, 'GetOrder').toFixed(2)}]
        S1[Single Table<br/>${this.getRCUByOperation(report.singleTable.operationsByType, 'GetOrder').toFixed(2)}]
    end
    
    subgraph "GetUserOrders RCU"
        R2[Relational<br/>${this.getRCUByOperation(report.relational.operationsByType, 'GetUserOrders').toFixed(2)}]
        S2[Single Table<br/>${this.getRCUByOperation(report.singleTable.operationsByType, 'GetUserOrders').toFixed(2)}]
    end
    
    subgraph "GetUserOrdersWithGSI RCU"
        R3[Relational<br/>${this.getRCUByOperation(report.relational.operationsByType, 'GetUserOrdersWithGSI').toFixed(2)}]
        S3[Single Table<br/>${this.getRCUByOperation(report.singleTable.operationsByType, 'GetUserOrdersWithGSI').toFixed(2)}]
    end
\`\`\`

## Summary
### Fastest Function
- **Function**: ${report.performance.fastestRequest.testName}
- **Design**: ${report.performance.fastestRequest.design}
- **Latency**: ${report.performance.fastestRequest.duration}ms
- **Records**: ${report.performance.fastestRequest.recordCount || 'N/A'}

### Slowest Function
- **Function**: ${report.performance.slowestRequest.testName}
- **Design**: ${report.performance.slowestRequest.design}
- **Latency**: ${report.performance.slowestRequest.duration}ms
- **Records**: ${report.performance.slowestRequest.recordCount || 'N/A'}

### Overall Performance
- **Relational Average**: ${report.relational.averageLatency.toFixed(2)}ms
- **Single Table Average**: ${report.singleTable.averageLatency.toFixed(2)}ms
- **Improvement**: ${report.comparison.latencyImprovement.toFixed(2)}%

---
*Generated on: ${new Date().toISOString()}*
*AWS Region: ${report.summary.region}*
*Test Configuration: ${this.config.userCount} users, ${this.config.orderCount.toLocaleString()} orders*
${this.networkInfo ? `*Network: ${this.networkInfo.city || 'Unknown'}, ${this.networkInfo.country} - ${this.networkInfo.isp || 'Unknown'}*` : ''}
`;
    }

    // Helper method for percentile calculations
    private getPercentile(values: number[], percentile: number): number {
        if (values.length === 0) return 0;

        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    }
}