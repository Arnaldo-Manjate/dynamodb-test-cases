import { DynamoDBClient, DescribeTableCommand, ListTablesCommand } from '@aws-sdk/client-dynamodb';

async function debugTables() {
    const region = process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || 'us-east-1';
    const client = new DynamoDBClient({ region });

    console.log('🔍 Debugging DynamoDB Tables...');
    console.log(`Region: ${region}`);
    console.log('');

    try {
        // First, list all tables
        console.log('📋 Listing all tables in the region:');
        const listCommand = new ListTablesCommand({});
        const listResponse = await client.send(listCommand);

        if (listResponse.TableNames && listResponse.TableNames.length > 0) {
            listResponse.TableNames.forEach(tableName => {
                console.log(`  - ${tableName}`);
            });
        } else {
            console.log('  No tables found in this region');
        }
        console.log('');

        // Check specific tables we expect
        const expectedTables = [
            'users-table-relational',
            'orders-table-relational',
            'single-table-design'
        ];

        console.log('🔍 Checking expected tables:');
        for (const tableName of expectedTables) {
            try {
                console.log(`  Checking: ${tableName}`);
                const describeCommand = new DescribeTableCommand({
                    TableName: tableName
                });

                const response = await client.send(describeCommand);
                const table = response.Table;

                if (table) {
                    console.log(`    ✅ Status: ${table.TableStatus}`);
                    console.log(`    📊 ItemCount: ${table.ItemCount || 0}`);
                    console.log(`    🔑 Partition Key: ${table.KeySchema?.[0]?.AttributeName}`);
                    if (table.KeySchema && table.KeySchema.length > 1) {
                        console.log(`    🔑 Sort Key: ${table.KeySchema[1]?.AttributeName}`);
                    }
                    console.log(`    🏷️  Billing Mode: ${table.BillingModeSummary?.BillingMode || 'Unknown'}`);
                }
            } catch (error) {
                console.log(`    ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            console.log('');
        }

    } catch (error) {
        console.error('❌ Error listing tables:', error);
    }
}

debugTables().catch(console.error); 