import {
    RelationalUser,
    RelationalPost,
    RelationalComment,
    SingleTableUser,
    SingleTablePost,
    SingleTableComment,
    RelationalTestData,
    SingleTableTestData,
    CompleteTestData,
    EntityType
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

    private static readonly COMMENT_CONTENT = [
        "Great post!",
        "Thanks for sharing",
        "Interesting perspective",
        "Well said!",
        "I agree with this",
        "Food for thought",
        "Nice insights",
        "Keep it up!",
        "This is helpful",
        "Good point!"
    ];

    static generateRelationalTestData(
        userCount: number,
        postCount: number,
        commentCount: number
    ): RelationalTestData {
        const users = this.generateRelationalUsers(userCount);
        const posts = this.generateRelationalPosts(postCount, users, 0); // postsPerUser no longer used
        const comments = this.generateRelationalComments(commentCount, users, posts, 0); // commentsPerUser no longer used

        return {
            users,
            posts,
            comments
        };
    }

    static generateSingleTableTestData(
        userCount: number,
        postCount: number,
        commentCount: number
    ): SingleTableTestData {
        const relationalUsers = this.generateRelationalUsers(userCount);
        const relationalPosts = this.generateRelationalPosts(postCount, relationalUsers, Math.ceil(postCount / userCount)); // Distribute posts randomly
        const relationalComments = this.generateRelationalComments(commentCount, relationalUsers, relationalPosts, Math.ceil(commentCount / userCount)); // Distribute comments randomly

        return {
            users: this.generateSingleTableUsers(relationalUsers),
            posts: this.generateSingleTablePosts(relationalPosts),
            comments: this.generateSingleTableComments(relationalComments)
        };
    }

    static generateTestData(
        userCount: number,
        postCount: number,
        commentCount: number
    ): CompleteTestData {
        return {
            relational: this.generateRelationalTestData(userCount, postCount, commentCount),
            singleTable: this.generateSingleTableTestData(userCount, postCount, commentCount)
        };
    }

    static generateRelationalUsers(count: number): RelationalUser[] {
        const users: RelationalUser[] = [];

        for (let i = 1; i <= count; i++) {
            const userId = `user-${i.toString().padStart(5, '0')}`;
            users.push({
                userId: userId,
                id: userId,
                email: `user${i}@example.com`,
                username: `user${i}`,
                createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
            });
        }

        return users;
    }

    static generateRelationalPosts(count: number, users: RelationalUser[], postsPerUser: number): RelationalPost[] {
        const posts: RelationalPost[] = [];

        for (let i = 1; i <= count; i++) {
            // Randomly distribute posts across users 
            const userId = users[i % users.length].id;
            const postId = `post-${i.toString().padStart(8, '0')}`;
            const createdAt = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString();
            const content = this.POST_CONTENT[Math.floor(Math.random() * this.POST_CONTENT.length)];

            posts.push({
                postId: postId,
                id: postId,
                userId,
                content,
                createdAt
            });
        }

        return posts;
    }

    static generateRelationalComments(count: number, users: RelationalUser[], posts: RelationalPost[], commentsPerUser: number): RelationalComment[] {
        const comments: RelationalComment[] = [];

        for (let i = 1; i <= count; i++) {
            // Randomly distribute comments across users and posts using modulo
            const userId = users[i % users.length].id;
            const post = posts[i % posts.length];
            const postId = post.id;
            const postAuthorUserId = post.userId; // Get the post author's userId
            const commentId = `comment-${i.toString().padStart(8, '0')}`;
            const createdAt = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString();
            const content = this.COMMENT_CONTENT[Math.floor(Math.random() * this.COMMENT_CONTENT.length)];

            comments.push({
                commentId,
                id: commentId,
                userId,
                postId,
                postAuthorUserId, // Include post author's userId for GSI
                content,
                createdAt
            });
        }

        return comments;
    }


    static generateSingleTableUsers(users: RelationalUser[]): SingleTableUser[] {
        return users.map(user => ({
            PK: `${EntityType.USER}#${user.id}`,
            SK: `${EntityType.USER}#${user.id}`,
            entityType: EntityType.USER,
            id: user.id,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt
        }));
    }

    static generateSingleTablePosts(posts: RelationalPost[]): SingleTablePost[] {
        return posts.map(post => ({
            PK: `${EntityType.USER}#${post.userId}`, // User is always the partition key
            SK: `${EntityType.POST}#${post.createdAt}`, // Static identifier + date as sort key
            entityType: EntityType.POST,
            id: post.id,
            userId: post.userId,
            content: post.content,
            createdAt: post.createdAt,
            datePrefix: post.createdAt.split('T')[0],

            // our secondary, less frequent access pattern
            GSI1PK: EntityType.POST,
            GSI1SK: post.createdAt
        }));
    }

    static generateSingleTableComments(comments: RelationalComment[]): SingleTableComment[] {
        return comments.map(comment => ({
            PK: `${EntityType.USER}#${comment.userId}`, // User is always the partition key
            SK: `${EntityType.COMMENT}#${comment.createdAt}`, // Static identifier + date as sort key
            entityType: EntityType.COMMENT,
            id: comment.id,
            userId: comment.userId,
            postId: comment.postId,
            content: comment.content,
            createdAt: comment.createdAt,
            datePrefix: comment.createdAt.split('T')[0],

            // our secondary, less frequent access pattern
            GSI1PK: `${EntityType.COMMENT}`,
            GSI1SK: comment.createdAt
        }));
    }

} 