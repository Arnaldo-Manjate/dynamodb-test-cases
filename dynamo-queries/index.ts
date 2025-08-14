import { TestService } from './service/test-service';

async function main() {
    // Parse command line arguments
    const args = process.argv.slice(2);

    // Default configuration
    const config = {
        userCount: 5,
        postCount: 20,
        commentCount: 50,
        likeCount: 100
    };

    // Override defaults with command line arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--user-count':
                config.userCount = parseInt(args[i + 1]);
                i++; // Skip the value on next iteration
                break;
            case '--post-count':
                config.postCount = parseInt(args[i + 1]);
                i++; // Skip the value on next iteration
                break;
            case '--comment-count':
                config.commentCount = parseInt(args[i + 1]);
                i++; // Skip the value on next iteration
                break;
            case '--like-count':
                config.likeCount = parseInt(args[i + 1]);
                i++; // Skip the value on next iteration
                break;
        }
    }

    console.log(`🎯 DynamoDB Design Patterns - 6 Points Side by Side`);
    console.log(`Configuration: ${config.userCount} users, ${config.postCount} posts, ${config.commentCount} comments, ${config.likeCount} likes`);
    console.log(`Distribution: Random distribution across users\n`);

    try {
        const testService = new TestService();
        await testService.runAllTests(config.userCount, config.postCount, config.commentCount, config.likeCount);
    } catch (error) {
        console.error(error);
    }
}

// Run the demonstration
main().catch(console.error);