import TestRunner from './service/test.runner.service';


async function main() {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const reportOnly = args.includes('--report-only');

    // Parse configuration arguments
    const userCountIndex = args.indexOf('--user-count');
    const orderCountIndex = args.indexOf('--order-count');
    const testUserCountIndex = args.indexOf('--test-user-count');

    // Validate arguments
    if (userCountIndex !== -1 && (!args[userCountIndex + 1] || isNaN(parseInt(args[userCountIndex + 1])))) {
        console.error('Error: --user-count requires a valid number');
        process.exit(1);
    }

    if (orderCountIndex !== -1 && (!args[orderCountIndex + 1] || isNaN(parseInt(args[orderCountIndex + 1])))) {
        console.error('Error: --order-count requires a valid number');
        process.exit(1);
    }

    if (testUserCountIndex !== -1 && (!args[testUserCountIndex + 1] || isNaN(parseInt(args[testUserCountIndex + 1])))) {
        console.error('Error: --test-user-count requires a valid number');
        process.exit(1);
    }

    const config = {
        userCount: userCountIndex !== -1 ? parseInt(args[userCountIndex + 1]) : undefined,
        orderCount: orderCountIndex !== -1 ? parseInt(args[orderCountIndex + 1]) : undefined,
        testUserCount: testUserCountIndex !== -1 ? parseInt(args[testUserCountIndex + 1]) : undefined
    };

    const runner = new TestRunner(config);

    if (reportOnly) {
        console.info('Running in report-only mode (skipping data insertion)...');
        await runner.runReportOnly();
    } else {
        console.info('Running full test suite (inserting data and generating report)...');
        await runner.runAllTests();
    }
}

if (require.main === module) {
    main().catch(console.error);
} 