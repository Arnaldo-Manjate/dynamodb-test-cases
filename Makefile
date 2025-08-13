# DynamoDB Performance Test Project Makefile

# Default values
USER_COUNT ?= 5
POST_COUNT ?= 25
AWS_REGION ?= us-east-1

.PHONY: install deploy destroy query-tables demo clean

# Install dependencies
install:
	cd infrastructure && pnpm install
	cd dynamo-queries && pnpm install

# Deploy infrastructure
deploy:
	cd infrastructure && pnpm run deploy

# Destroy infrastructure
destroy:
	cd infrastructure && pnpm run destroy

# Check if required tables exist
query-tables:
	cd dynamo-queries && AWS_REGION=$(AWS_REGION) pnpm run query-tables

# Run the dynamo-queries demonstration
demo:
	cd dynamo-queries && AWS_REGION=$(AWS_REGION) pnpm start -- --user-count $(USER_COUNT) --post-count $(POST_COUNT)

# Clean up generated files
clean:
	rm -f dynamo-queries/dist/*
	rm -rf dynamo-queries/dist/ 