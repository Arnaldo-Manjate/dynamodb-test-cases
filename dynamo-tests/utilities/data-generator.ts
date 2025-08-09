import { User, Order, SingleTableUser, SingleTableOrder, OrderItem } from '../types';

export class DataGenerator {
    private static readonly PRODUCTS = [
        'Laptop', 'Smartphone', 'Headphones', 'Tablet', 'Smartwatch',
        'Camera', 'Speaker', 'Keyboard', 'Mouse', 'Monitor'
    ];

    private static readonly STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

    static generateUsers(count: number): User[] {
        const users: User[] = [];

        for (let i = 1; i <= count; i++) {
            const userId = `user-${i.toString().padStart(5, '0')}`;
            const createdAt = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString();
            const lastLoginAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString();

            users.push({
                userId,
                email: `user${i}@example.com`,
                name: `User ${i}`,
                createdAt,
                lastLoginAt
            });
        }

        return users;
    }

    static generateOrders(count: number, users: User[]): Order[] {
        const orders: Order[] = [];

        console.info(`Distributing ${count} orders evenly among ${users.length} test users`);

        let orderCounter = 1;

        // Distribute orders evenly among users to avoid hot partitions
        for (let i = 0; i < count; i++) {
            // Use modulo to ensure even distribution
            const userIndex = i % users.length;
            const selectedUser = users[userIndex];

            const orderId = `order-${orderCounter.toString().padStart(8, '0')}`;
            const orderDate = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString();
            const items = this.generateOrderItems();
            const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

            orders.push({
                orderId,
                userId: selectedUser.userId,
                orderDate,
                totalAmount,
                status: this.STATUSES[Math.floor(Math.random() * this.STATUSES.length)] as any,
                items
            });

            orderCounter++;
        }

        // Log distribution stats
        const userOrderCounts = users.map(user => ({
            userId: user.userId,
            orderCount: orders.filter(order => order.userId === user.userId).length
        }));

        console.info('Order distribution among test users:');
        userOrderCounts.forEach(({ userId, orderCount }) => {
            console.info(`  ${userId}: ${orderCount} orders`);
        });

        return orders;
    }

    static generateSingleTableUsers(users: User[]): SingleTableUser[] {
        return users.map(user => ({
            PK: `USER#${user.userId}`,
            SK: `USER#${user.userId}`,
            entityType: 'USER',
            userId: user.userId,
            email: user.email,
            name: user.name,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt
        }));
    }

    static generateSingleTableOrders(orders: Order[]): SingleTableOrder[] {
        return orders.map(order => ({
            PK: `USER#${order.userId}`,
            SK: `ORDER#${order.orderId}#${order.orderDate.split('T')[0]}`,
            entityType: 'ORDER',
            orderId: order.orderId,
            userId: order.userId,
            orderDate: order.orderDate,
            totalAmount: order.totalAmount,
            status: order.status,
            items: order.items
        }));
    }

    private static generateOrderItems(): OrderItem[] {
        const itemCount = 1
        const items: OrderItem[] = []

        for (let i = 0; i < itemCount; i++) {
            const productName = this.PRODUCTS[Math.floor(Math.random() * this.PRODUCTS.length)];
            const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 quantity
            const unitPrice = Math.floor(Math.random() * 1000) + 10; // $10-$1000

            items.push({
                itemId: `item-${Math.random().toString()}`,
                productName,
                quantity,
                unitPrice
            });
        }

        return items;
    }

    static generateTestData(userCount: number = 10, orderCount: number = 10000): {
        users: User[];
        orders: Order[];
        singleTableUsers: SingleTableUser[];
        singleTableOrders: SingleTableOrder[];
    } {
        console.info('Generating test data...');

        // Generate users and orders for testing
        const users = this.generateUsers(userCount);
        console.info(`Generated ${users.length} users for testing`);
        const orders = this.generateOrders(orderCount, users);
        console.info(`Generated ${orders.length} orders`);

        // Generate single table versions
        const singleTableUsers = this.generateSingleTableUsers(users);
        const singleTableOrders = this.generateSingleTableOrders(orders);

        return {
            users,
            orders,
            singleTableUsers,
            singleTableOrders
        };
    }

    static generateMinimalReportTestData(): any {
        const users = Array.from({ length: 10 }, (_, i) => ({
            userId: `user-${(i + 1).toString().padStart(5, '0')}`
        }));

        const singleTableUsers = Array.from({ length: 10 }, (_, i) => ({
            userId: `user-${(i + 1).toString().padStart(5, '0')}`,
            PK: `USER#user-${(i + 1).toString().padStart(5, '0')}`,
            SK: `USER#user-${(i + 1).toString().padStart(5, '0')}`
        }));

        return { users, singleTableUsers };
    }
} 