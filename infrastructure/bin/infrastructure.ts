#!/usr/bin/env node;
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DynamodbTestcasesStack } from '../lib/infrastructure-stack';

const app = new cdk.App();

// Get AWS account and region from environment variables or use defaults
const account = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID;
const region = process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1';

if (!account) {
    console.warn('Warning: AWS account not set. Please configure your AWS credentials:');
}

console.log(`Deploying to AWS Account: ${account || 'Not configured'}`);
console.log(`AWS Region: ${region}`);

new DynamodbTestcasesStack(app, 'DynamodbTestcasesStack', {
    env: {
        account: account,
        region: region
    },
}); 