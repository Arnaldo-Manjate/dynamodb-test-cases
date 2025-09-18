import {
    RelationalUser,
    RelationalPost,
    RelationalComment,
    RelationalFollower,
    RelationalLike,
    SingleTableUser,
    SingleTablePost,
    SingleTableComment,
    SingleTableFollower,
    SingleTableLike,
    RelationalTestData,
    SingleTableTestData,
    CompleteTestData,
    EntityType,
    RelationalUserFollowing
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
        commentCount: number,
        likeCount: number
    ): RelationalTestData {
        const users = this.generateRelationalUsers(userCount);
        const posts = this.generateRelationalPosts(postCount, users, 0); // postsPerUser no longer used
        const comments = this.generateRelationalComments(commentCount, users, posts, 0); // commentsPerUser no longer used
        // Generate more followers than users to create realistic social media following patterns
        const followerCount = Math.max(userCount * 2, 10); // At least 2x users or minimum 10
        const followers = this.generateRelationalFollowers(followerCount, users);
        const userFollowings = this.generateRelationalUserFollowing(followers);
        const likes = this.generateRelationalLikes(likeCount, users, posts, 0); // likesPerUser no longer used

        return {
            users,
            posts,
            comments,
            followers,
            userFollowings,
            likes
        };
    }

    static generateSingleTableTestData(
        userCount: number,
        postCount: number,
        commentCount: number,
        likeCount: number
    ): SingleTableTestData {
        const relationalUsers = this.generateRelationalUsers(userCount);
        const relationalPosts = this.generateRelationalPosts(postCount, relationalUsers, Math.ceil(postCount / userCount)); // Distribute posts randomly
        const relationalComments = this.generateRelationalComments(commentCount, relationalUsers, relationalPosts, Math.ceil(commentCount / userCount)); // Distribute comments randomly
        // Generate more followers than users to create realistic social media following patterns
        const followerCount = Math.max(userCount * 2, 10); // At least 2x users or minimum 10
        const relationalFollowers = this.generateRelationalFollowers(followerCount, relationalUsers);
        const relationalLikes = this.generateRelationalLikes(likeCount, relationalUsers, relationalPosts, Math.ceil(likeCount / userCount)); // Distribute likes randomly

        return {
            users: this.generateSingleTableUsers(relationalUsers),
            posts: this.generateSingleTablePosts(relationalPosts),
            comments: this.generateSingleTableComments(relationalComments),
            followers: this.generateSingleTableFollowers(relationalFollowers),
            likes: this.generateSingleTableLikes(relationalLikes)
        };
    }

    static generateTestData(
        userCount: number,
        postCount: number,
        commentCount: number,
        likeCount: number
    ): CompleteTestData {
        return {
            relational: this.generateRelationalTestData(userCount, postCount, commentCount, likeCount),
            singleTable: this.generateSingleTableTestData(userCount, postCount, commentCount, likeCount)
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

    static generateRelationalFollowers(count: number, users: RelationalUser[]): RelationalFollower[] {
        const followers: RelationalFollower[] = [];
        const usedRelationships = new Set<string>(); // Track unique follower-following pairs

        for (let i = 1; i <= count; i++) {
            let followerId: string;
            let followingId: string;
            let relationshipKey: string;

            // Generate unique follower-following relationships
            do {
                // Randomly select follower and following users
                const followerIndex = Math.floor(Math.random() * users.length);
                const followingIndex = Math.floor(Math.random() * users.length);

                followerId = users[followerIndex].id;
                followingId = users[followingIndex].id;
                relationshipKey = `${followerId}-${followingId}`;

                // Ensure users don't follow themselves
                if (followerId === followingId) {
                    continue;
                }
            } while (usedRelationships.has(relationshipKey));

            // Add this relationship to our set
            usedRelationships.add(relationshipKey);

            const followId = `follow-${i.toString().padStart(8, '0')}`;
            const createdAt = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString();

            followers.push({
                followId, // Internal ID
                id: followId,
                followerId, // User who is following
                followingId, // User being followed
                createdAt
            });
        }

        return followers;
    }

    static generateRelationalUserFollowing(followers: RelationalFollower[]): RelationalUserFollowing[] {
        // Convert followers to user-following format for the new table
        return followers.map(follower => ({
            followId: follower.followId,
            id: follower.followId,
            followerId: follower.followerId,
            followingId: follower.followingId,
            createdAt: follower.createdAt
        }));
    }

    static generateRelationalLikes(count: number, users: RelationalUser[], posts: RelationalPost[], likesPerUser: number): RelationalLike[] {
        const likes: RelationalLike[] = [];

        for (let i = 1; i <= count; i++) {
            // Randomly distribute likes across users and posts using modulo
            const userId = users[i % users.length].id;
            const post = posts[i % posts.length];
            const postId = post.id;
            const postAuthorUserId = post.userId; // Get the post author's userId
            const likeId = `like-${i.toString().padStart(8, '0')}`;
            const createdAt = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString();

            likes.push({
                likeId,
                id: likeId,
                userId,
                postId,
                postAuthorUserId, // Include post author's userId for GSI
                createdAt
            });
        }

        return likes;
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

    static generateSingleTableFollowers(followers: RelationalFollower[]): SingleTableFollower[] {
        return followers.map(follower => ({
            PK: `${EntityType.USER}#${follower.followingId}`,
            SK: `${EntityType.FOLLOWER}#${follower.createdAt}`,
            entityType: EntityType.FOLLOWER,
            id: follower.id,
            followerId: follower.followerId,
            followingId: follower.followingId,
            createdAt: follower.createdAt,
            datePrefix: follower.createdAt.split('T')[0]
        }));
    }

    static generateSingleTableLikes(likes: RelationalLike[]): SingleTableLike[] {
        return likes.map(like => ({
            PK: `${EntityType.USER}#${like.userId}`, // User is always the partition key
            SK: `${EntityType.LIKE}#${like.createdAt}`, // Static identifier + date as sort key
            entityType: EntityType.LIKE,
            id: like.id,
            userId: like.userId,
            postId: like.postId,
            createdAt: like.createdAt,
            datePrefix: like.createdAt.split('T')[0]
        }));
    }
} 