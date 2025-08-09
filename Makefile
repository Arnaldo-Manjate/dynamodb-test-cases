# DynamoDB Performance Test Project Makefile

# Default values
USER_COUNT ?= 10
ORDER_COUNT ?= 1000
TEST_USER_COUNT ?= 10
AWS_REGION ?= us-east-1

.PHONY: install deploy destroy run-tests report-only clean

# Install dependencies
install:
	cd infrastructure && pnpm install
	cd dynamo-tests && pnpm install

# Deploy infrastructure
deploy:
	cd infrastructure && pnpm run deploy

# Destroy infrastructure
destroy:
	cd infrastructure && pnpm run destroy

# Run full test suite
run-tests:
	cd dynamo-tests && AWS_REGION=$(AWS_REGION) pnpm run run-tests -- --user-count $(USER_COUNT) --order-count $(ORDER_COUNT) --test-user-count $(TEST_USER_COUNT)

# Run report only (no data insertion)
report-only:
	cd dynamo-tests && AWS_REGION=$(AWS_REGION) pnpm run report-only -- --test-user-count $(TEST_USER_COUNT)

# Clean up generated files
clean:
	rm -f dynamo-tests/test-results.json
	rm -f dynamo-tests/results.md 