import { TestService } from './service/test-service';

async function main() {
    // Parse command line arguments
    const args = process.argv.slice(2);

    // Default configuration
    const config = {
        userCount: 5,
        postCount: 20
    };

    // Override defaults with command line arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--user-count' && i + 1 < args.length) {
            config.userCount = parseInt(args[i + 1]);
        } else if (arg === '--post-count' && i + 1 < args.length) {
            config.postCount = parseInt(args[i + 1]);
        }
    }

    console.log(`🎯 DynamoDB Design Patterns - 6 Points Side by Side`);
    console.log(`Configuration: ${config.userCount} users, ${config.postCount} posts\n`);

    try {
        const testService = new TestService();
        await testService.runAllTests(config.userCount, config.postCount);
    } catch (error) {
        console.error(error);
    }
}

// Run the demonstration
main().catch(console.error); 