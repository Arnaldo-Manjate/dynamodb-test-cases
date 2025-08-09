# DynamoDB Performance Comparison Project

This project demonstrates the performance and cost differences between **Relational Table Design** and **Single Table Design** in DynamoDB, validating the principles discussed in the article about DynamoDB schema design.

## 🎯 Project Structure

```
dynamodb-testcases/
├── Makefile                    # Project commands and configuration
├── infrastructure/             # CDK infrastructure code
│   ├── lib/
│   │   └── infrastructure-stack.ts  # DynamoDB tables definition
│   ├── bin/
│   │   └── infrastructure.ts        # CDK app entry point
│   └── package.json
├── dynamo-tests/              # Performance test suite
│   ├── dao/                  # Data Access Objects
│   ├── types/                # TypeScript type definitions
│   ├── utils/                # Utilities and data generators
│   ├── tests/                # Test files
│   └── package.json
└── README.md                 # This file
```

## Quick Start

### Prerequisites
- AWS CLI configured with appropriate permissions
- Node.js 18+ and pnpm installed
- CDK installed globally
- Make (usually pre-installed on Unix systems)

### AWS Configuration (CRITICAL!)
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

### Step 1: Install Dependencies
```bash
make install
```

### Step 2: Deploy Infrastructure
```bash
make deploy
```

### Step 3: Run Performance Tests
```bash
# Run with default configuration (10 users, 50,000 orders)
make run-tests

# Run with custom configuration
make run-tests USER_COUNT=1000 ORDER_COUNT=100000 TEST_USER_COUNT=20

# Run report-only mode (skip data insertion)
make report-only TEST_USER_COUNT=5
```

### Configuration Options
You can customize the test parameters using environment variables:

- `USER_COUNT`: Total number of users to generate (default: 10)
- `ORDER_COUNT`: Total number of orders to generate (default: 50,000)
- `TEST_USER_COUNT`: Number of users to test (default: 10)
- `AWS_REGION`: AWS region (default: us-east-1)

**Examples:**
```bash
# Large scale test
make run-tests USER_COUNT=10000 ORDER_COUNT=1000000 TEST_USER_COUNT=100

# Quick test with minimal data
make run-tests USER_COUNT=5 ORDER_COUNT=1000 TEST_USER_COUNT=3

# Report only mode
make report-only TEST_USER_COUNT=5
```

### Step 4: View Results
After test completion, check the generated files in `dynamo-tests/`:
- `test-results.json`: Detailed test results with timing data
- `results.md`: Beautiful markdown report with performance metrics and graphs

### Step 5: Cleanup
To avoid AWS charges, destroy the infrastructure:
```bash
make destroy
```

To clean up generated files:
```bash
make clean
```

## Available Commands

### Main Commands
- `make install` - Install all dependencies
- `make deploy` - Deploy DynamoDB infrastructure
- `make destroy` - Destroy infrastructure (cleanup)
- `make run-tests` - Run full test suite
- `make report-only` - Run tests on existing data (no insertion)
- `make clean` - Clean up generated files 