import { TestService } from './service/test-service';

async function main() {
    // Parse command line arguments
    const args = process.argv.slice(2);

    // Default configuration
    const config = {
        userCount: 5,
        orderCount: 20,
        orderItemCount: 50,
        skipDataInsertion: false
    };

    // Check for clear-all-data flag first
    if (args.includes('--clear-all-data')) {
        console.log('🗑️  Clearing all data from DynamoDB tables...');
        try {
            const testService = new TestService();
            await testService.clearAllData();
            console.log('✅ All data cleared successfully!');
            return;
        } catch (error) {
            console.error('❌ Failed to clear data:', error);
            return;
        }
    }

    // Override defaults with command line arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--user-count':
                config.userCount = parseInt(args[i + 1]);
                i++; // Skip the value on next iteration
                break;
            case '--order-count':
                config.orderCount = parseInt(args[i + 1]);
                i++; // Skip the value on next iteration
                break;
            case '--orderitem-count':
                config.orderItemCount = parseInt(args[i + 1]);
                i++; // Skip the value on next iteration
                break;
            case '--skip-data-insertion':
                config.skipDataInsertion = args[i + 1] === 'true';
                i++; // Skip the value on next iteration
                break;
        }
    }

    console.log(`🎯 DynamoDB Design Patterns - 6 Points Side by Side`);
    console.log(`Configuration: ${config.userCount} users, ${config.orderCount} orders, ${config.orderItemCount} orderItems`);
    console.log(`Distribution: Random distribution across users\n`);

    try {
        const testService = new TestService();
        await testService.runAllTests(config.userCount, config.orderCount, config.orderItemCount, config.skipDataInsertion);
    } catch (error) {
        console.error(error);
    }
}

// Run the demonstration
main().catch(console.error);