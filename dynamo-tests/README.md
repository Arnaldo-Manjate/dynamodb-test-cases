# DynamoDB Performance Test Suite

This project demonstrates the performance differences between **Relational Table Design** and **Single Table Design** in DynamoDB, validating the principles discussed in the article about DynamoDB schema design.

## 🎯 Project Overview

The test suite compares two DynamoDB design patterns:

1. **Relational Design**: Separate tables for Users and Orders (traditional approach)
2. **Single Table Design**: Combined table with proper key design (NoSQL best practice)

## 📊 Test Scenarios

### Data Volume
- **Configurable users** (default: 10 users)
- **Configurable orders** (default: 50,000 orders)
- **Random distribution**: Some users get more orders, some get fewer
- **Varied order counts**: 0-200 orders per user, scaled to match target

### Performance Tests
- **GetItem operations** (individual record retrieval)
- **Query operations** (with and without GSI)
- **BatchWrite operations** (bulk data insertion)
- **BatchGet operations** (bulk data retrieval)
- **Complex queries** (user with orders)

## 🏗️ Infrastructure

### Tables Created
1. **users-table-relational**: Users table for relational design
2. **orders-table-relational**: Orders table for relational design
3. **single-table-design**: Combined table for single-table design

### GSIs (Global Secondary Indexes)
- **OrderIdIndex**: On orders table for efficient user order queries
- **EntityTypeIndex**: On single table for entity type filtering

## 🚀 Quick Start

### Prerequisites
- AWS CLI configured with appropriate permissions
- Node.js 18+ and pnpm installed
- CDK installed globally

### AWS Configuration 
Before running tests, ensure your AWS credentials and region are properly configured:

```bash
# Configure AWS CLI with your credentials
aws configure

# Set your AWS region (recommended: us-east-1, us-west-2, eu-west-1)
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Verify your configuration
aws sts get-caller-identity
```

**Note**: The tests will default to `us-east-1` if no region is specified, but it's recommended to explicitly set your preferred region.

### Infrastructure Configuration

#### Environment Variables
```bash
# Required for AWS access
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=your-account-id


### Using the Makefile (Recommended)

From the root directory, use the Makefile for easy project management:

```bash
# Install dependencies
make install

# Deploy infrastructure
make deploy

# Run tests with default configuration
make run-tests

# Run tests with custom configuration
make run-tests USER_COUNT=1000 ORDER_COUNT=100000 TEST_USER_COUNT=20

# Run report-only mode
make report-only TEST_USER_COUNT=5

# Cleanup
make destroy
```

### Configuration Options
You can customize the test parameters using command line arguments:

- `--user-count <number>`: Total number of users to generate (default: 10)
- `--order-count <number>`: Total number of orders to generate (default: 50,000)
- `--test-user-count <number>`: Number of users to test (default: 10)
- `--report-only`: Skip data insertion, run tests on existing Dynamo data

**Examples:**
```bash
# Large scale test
make run-tests USER_COUNT=10000 ORDER_COUNT=1000000 TEST_USER_COUNT=100

# Quick test with minimal data
make run-tests USER_COUNT=5 ORDER_COUNT=1000 TEST_USER_COUNT=3

# Report only mode
make report-only TEST_USER_COUNT=5
```

## 📈 Expected Results

The tests will demonstrate:

### Performance Improvements
- **Reduced latency** through fewer network hops
- **Lower RCU/WCU consumption** through efficient queries
- **Better scalability** by leveraging DynamoDB's architecture

### Cost Benefits
- **Fewer queries** = lower costs
- **Efficient capacity usage** with on-demand billing
- **Reduced complexity** in application code


### Test Parameters
- **Total Users**: Configurable via `--user-count` (default: 10)
- **Total Orders**: Configurable via `--order-count` (default: 50,000)
- **Test Users**: Configurable via `--test-user-count` (default: 10)
- **Distribution**: Random (some users get more orders than others)
- **Batch Size**: 25 (DynamoDB limit)
- **Test Iterations**: Configurable number of users tested

### AWS Configuration
- **Region**: us-east-1 (configurable via environment)
- **Billing Mode**: On-demand (PAY_PER_REQUEST)
- **Removal Policy**: DESTROY (for testing)

## 📋 Test Cases

### Relational Design Tests
1. **GetUser**: Retrieve individual user
2. **GetUserOrders**: Query user orders using GSI
3. **GetUserOrdersWithoutGSI**: Query without GSI (inefficient)
4. **GetUserWithOrders**: Multiple queries for related data

### Single Table Design Tests
1. **GetUser**: Retrieve individual user
2. **GetUserOrders**: Single query for user orders
3. **GetUserWithOrders**: Single query for user + orders
4. **GetAllUsers**: Query all users using GSI
5. **GetAllOrders**: Query all orders using GSI

## 🧹 Cleanup

To avoid charges, destroy the infrastructure:
```bash
# Using Makefile (recommended)
make destroy

# Or manually
cd infrastructure
pnpm run destroy
```

## 📚 Architecture

### DAO Layer
- **BaseDAO**: Abstract class with common DynamoDB operations
- **RelationalDAO**: Implementation for separate tables
- **SingleTableDAO**: Implementation for combined table

### Utilities
- **DataGenerator**: Creates test data with realistic distribution
- **TestRunner**: Orchestrates test execution and reporting

### Types
- **User/Order**: Relational table types
- **SingleTableUser/SingleTableOrder**: Single table types
- **TestResult**: Performance measurement results

## 🎯 Key Insights

This test suite validates the article's key points:

1. **Multi-Hop Nightmare**: Relational design requires multiple queries
2. **One-Stop Shop**: Single table design enables single queries
3. **Efficiency Engine**: Fewer queries mean lower costs
4. **Query-First Paradigm**: Design for access patterns, not normalization

## 📄 License

This project is for educational purposes to demonstrate DynamoDB best practices.

## Viewing the Results

After running the tests, you'll find two files in the `dynamo-tests` directory:

- **`results.md`** - The detailed performance report with Mermaid diagrams
- **`test-results.json`** - Raw test data in JSON format

### Viewing Mermaid Graphs

The `results.md` file contains interactive Mermaid diagrams that show performance comparisons. To view them properly:

1. **GitHub/GitLab**: Upload the `results.md` file to GitHub or GitLab - they automatically render Mermaid graphs
2. **VS Code**: Install the "Markdown Preview Mermaid Support" extension
3. **Local viewing**: Open `report-viewer.html` in a web browser (included in the project)
4. **Other markdown viewers**: Use any markdown viewer that supports Mermaid diagrams

### Report Contents

The report includes:
- Performance metrics comparison between relational and single-table designs
- Latency analysis and cost breakdown
- 10 different Mermaid visualizations (graphs, charts, heatmaps)
- Detailed test results and recommendations 