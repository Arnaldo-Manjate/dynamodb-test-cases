# DynamoDB Performance Test Project Makefile

# Default values
USER_COUNT ?= 5
POST_COUNT ?= 25
COMMENT_COUNT ?= 50
LIKE_COUNT ?= 100
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

# run tests on existing data
query-tables:
	cd dynamo-queries && AWS_REGION=$(AWS_REGION) pnpm run query-tables

# Run the dynamo-queries demonstration
demo:
	cd dynamo-queries && AWS_REGION=$(AWS_REGION) pnpm start -- --user-count $(USER_COUNT) --post-count $(POST_COUNT) --comment-count $(COMMENT_COUNT) --like-count $(LIKE_COUNT)

# Clear all data from both single table and relational tables
clear-tables:
	cd dynamo-queries && AWS_REGION=$(AWS_REGION) pnpm start -- --clear-all-data

# Clean up generated files
clean:
	rm -f dynamo-queries/dist/*
	rm -rf dynamo-queries/dist/ 