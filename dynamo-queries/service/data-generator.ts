import {
    RelationalUser,
    RelationalPost,
    SingleTableUser,
    SingleTablePost,
    RelationalTestData,
    SingleTableTestData,
    CompleteTestData
} from '../@types';

export class DataGenerator {
    private static readonly POST_CONTENT = [
        "Just had an amazing day!",
        "Working on some exciting new features",
        "Coffee time ☕",
        "Learning new technologies",
        "Beautiful sunset today",
        "Productive coding session",
        "Great team meeting",
        "New project ideas",
        "Weekend plans",
        "Tech conference insights"
    ];

    static generateRelationalUsers(count: number): RelationalUser[] {
        const users: RelationalUser[] = [];

        for (let i = 1; i <= count; i++) {
            const userId = `user-${i.toString().padStart(5, '0')}`;
            users.push({
                PK: userId,
                id: userId,
                email: `user${i}@example.com`,
                username: `user${i}`,
                createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
            });
        }

        return users;
    }

    static generateRelationalPosts(count: number, users: RelationalUser[]): RelationalPost[] {
        const posts: RelationalPost[] = [];

        for (let i = 1; i <= count; i++) {
            const userId = users[i % users.length].id;
            const postId = `post-${i.toString().padStart(8, '0')}`;
            const createdAt = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString();
            const content = this.POST_CONTENT[Math.floor(Math.random() * this.POST_CONTENT.length)];

            posts.push({
                postId: postId, // Use 'postId' as the partition key to match table schema
                id: postId,
                userId,
                content,
                createdAt
            });
        }

        return posts;
    }

    static generateSingleTableUsers(users: RelationalUser[]): SingleTableUser[] {
        return users.map(user => ({
            PK: `USER#${user.id}`,
            SK: `USER#${user.id}`,
            entityType: 'USER' as const,
            id: user.id,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt
        }));
    }

    static generateSingleTablePosts(posts: RelationalPost[]): SingleTablePost[] {
        return posts.map(post => ({
            PK: `USER#${post.userId}`,
            SK: `POST#${post.id}#${post.createdAt.split('T')[0]}`,
            entityType: 'POST' as const,
            id: post.id,
            userId: post.userId,
            content: post.content,
            createdAt: post.createdAt,
            datePrefix: post.createdAt.split('T')[0]
        }));
    }

    static generateRelationalTestData(userCount: number, postCount: number): RelationalTestData {
        const users = this.generateRelationalUsers(userCount);
        const posts = this.generateRelationalPosts(postCount, users);

        return {
            users,
            posts
        };
    }

    static generateSingleTableTestData(userCount: number, postCount: number): SingleTableTestData {
        const relationalUsers = this.generateRelationalUsers(userCount);
        const relationalPosts = this.generateRelationalPosts(postCount, relationalUsers);

        const users = this.generateSingleTableUsers(relationalUsers);
        const posts = this.generateSingleTablePosts(relationalPosts);

        return {
            users,
            posts
        };
    }

    static generateTestData(userCount: number = 5, postCount: number = 20): CompleteTestData {
        console.log(`Generating test data: ${userCount} users, ${postCount} posts`);

        const relational = this.generateRelationalTestData(userCount, postCount);
        const singleTable = this.generateSingleTableTestData(userCount, postCount);

        return {
            relational,
            singleTable
        };
    }
} 