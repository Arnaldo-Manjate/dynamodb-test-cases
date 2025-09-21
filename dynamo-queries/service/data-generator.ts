import {
    RelationalUser,
    RelationalOrder,
    RelationalOrderItem,
    SingleTableUser,
    SingleTableOrder,
    SingleTableOrderItem,
    RelationalTestData,
    SingleTableTestData,
    CompleteTestData,
    EntityType
} from '../@types';

export class DataGenerator {
    private static readonly PRODUCT_NAMES = [
        "Wireless Headphones",
        "Smart Watch",
        "Laptop Stand",
        "Mechanical Keyboard",
        "Gaming Mouse",
        "USB-C Hub",
        "Bluetooth Speaker",
        "Phone Case",
        "Screen Protector",
        "Cable Organizer"
    ];

    private static readonly ORDER_STATUSES = [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancelled"
    ];

    private static readonly PRICING_PLANS = [
        "free",
        "premium",
        "enterprise"
    ];


    static generateTestData(
        userCount: number,
        orderCount: number,
        orderItemCount: number
    ): CompleteTestData {
        return {
            relational: this.generateRelationalTestData(userCount, orderCount, orderItemCount),
            singleTable: this.generateSingleTableTestData(userCount, orderCount, orderItemCount)
        };
    }

    static generateRelationalTestData(
        userCount: number,
        orderCount: number,
        orderItemCount: number
    ): RelationalTestData {
        const users = this.generateRelationalUsers(userCount);
        const orders = this.generateRelationalOrders(orderCount, users);
        const orderItems = this.generateRelationalOrderItems(orderItemCount, users, orders);

        return {
            users,
            orders,
            orderItems
        };
    }

    static generateSingleTableTestData(
        userCount: number,
        orderCount: number,
        orderItemCount: number
    ): SingleTableTestData {
        const relationalUsers = this.generateRelationalUsers(userCount);
        const relationalOrders = this.generateRelationalOrders(orderCount, relationalUsers);
        const relationalOrderItems = this.generateRelationalOrderItems(orderItemCount, relationalUsers, relationalOrders);

        return {
            users: this.generateSingleTableUsers(relationalUsers),
            orders: this.generateSingleTableOrders(relationalOrders),
            orderItems: this.generateSingleTableOrderItems(relationalOrderItems)
        };
    }


    static generateRelationalUsers(count: number): RelationalUser[] {
        const users: RelationalUser[] = [];

        for (let i = 1; i <= count; i++) {
            const userId = `user-${i.toString().padStart(5, '0')}`;
            // every 10th user (user-00010, user-00020, user-00030, etc.) is deactivated
            const status = i % 10 === 0 ? "deactivated" : "active";
            users.push({
                id: userId,
                email: `user${i}@example.com`,
                status: status,
                pricingPlan: this.PRICING_PLANS[Math.floor(Math.random() * this.PRICING_PLANS.length)],
                username: `user${i}`,
                createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
            });
        }

        return users;
    }

    static generateRelationalOrders(count: number, users: RelationalUser[]): RelationalOrder[] {
        const orders: RelationalOrder[] = [];

        for (let i = 1; i <= count; i++) {
            // Randomly distribute orders across users 
            const userId = users[i % users.length].id;
            const orderId = `order-${i.toString().padStart(8, '0')}`;
            const orderNumber = `ORD-${i.toString().padStart(6, '0')}`;
            const createdAt = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString();
            const status = this.ORDER_STATUSES[Math.floor(Math.random() * this.ORDER_STATUSES.length)];
            const totalAmount = Math.round((Math.random() * 1000 + 50) * 100) / 100; // $50-$1050

            orders.push({
                orderId: orderId,
                id: orderId,
                userId,
                orderNumber,
                totalAmount,
                status,
                createdAt
            });
        }

        return orders;
    }

    static generateRelationalOrderItems(count: number, users: RelationalUser[], orders: RelationalOrder[]): RelationalOrderItem[] {
        const orderItems: RelationalOrderItem[] = [];

        for (let i = 1; i <= count; i++) {
            // Randomly distribute orderItems across users and orders
            const userId = users[i % users.length].id;
            const order = orders[i % orders.length];
            const orderId = order.id;
            const orderCustomerUserId = order.userId; // Get the order customer's userId
            const orderItemId = `orderitem-${i.toString().padStart(8, '0')}`;
            const productId = `prod-${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`;
            const productName = this.PRODUCT_NAMES[Math.floor(Math.random() * this.PRODUCT_NAMES.length)];
            const quantity = Math.floor(Math.random() * 5) + 1; // 1-5 items
            const unitPrice = Math.round((Math.random() * 200 + 10) * 100) / 100; // $10-$210
            const createdAt = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString();

            orderItems.push({
                orderItemId,
                id: orderItemId,
                orderId,
                productId,
                productName,
                quantity,
                unitPrice,
                orderCustomerUserId, // Include order customer's userId for GSI
                createdAt
            });
        }

        return orderItems;
    }


    static generateSingleTableUsers(users: RelationalUser[]): SingleTableUser[] {
        return users.map(user => ({
            // main aim is to fill the users screen
            PK: EntityType.USER + '#' + user.id,
            SK: user.status + '#' + user.pricingPlan,
            entityType: EntityType.USER,
            id: user.id,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt,
            status: user.status,
            pricingPlan: user.pricingPlan,

            // our secondary, less frequent access pattern
            // second aim is top get all users by email
            GSI1PK: EntityType.USER,
            GSI1SK: user.email
        }));
    }

    static generateSingleTableOrders(orders: RelationalOrder[]): SingleTableOrder[] {
        return orders.map(order => ({
            PK: EntityType.USER + '#' + order.userId, // User is always the partition key
            SK: `${EntityType.ORDER}#${order.status}#${order.createdAt}`, // Static identifier + date as sort key
            entityType: EntityType.ORDER,
            id: order.id,
            userId: order.userId,
            orderNumber: order.orderNumber,
            totalAmount: order.totalAmount,
            status: order.status,
            createdAt: order.createdAt,
            datePrefix: order.createdAt.split('T')[0],

            // our secondary, less frequent access pattern
            GSI1PK: EntityType.ORDER,
            GSI1SK: order.status + '#' + order.createdAt
        }));
    }

    static generateSingleTableOrderItems(orderItems: RelationalOrderItem[]): SingleTableOrderItem[] {
        return orderItems.map(orderItem => ({
            PK: EntityType.USER + '#' + orderItem.orderCustomerUserId, // User is always the partition key
            SK: `${EntityType.ORDER_ITEM}#${orderItem.createdAt}`, // Static identifier + date as sort key
            entityType: EntityType.ORDER_ITEM,
            id: orderItem.id,
            orderId: orderItem.orderId,
            productId: orderItem.productId,
            productName: orderItem.productName,
            quantity: orderItem.quantity,
            unitPrice: orderItem.unitPrice,
            createdAt: orderItem.createdAt,
            datePrefix: orderItem.createdAt.split('T')[0],

            // our secondary, less frequent access pattern
            GSI1PK: EntityType.ORDER_ITEM,
            GSI1SK: orderItem.orderId
        }));
    }

} 