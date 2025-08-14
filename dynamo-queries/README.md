# DynamoDB Design Patterns - 6 Points Side by Side

This project demonstrates the difference between **bad patterns** (Relational Design) and **good patterns** (Single Table Design) in DynamoDB through practical examples.

## 🎯 What This Demonstrates

The project showcases **6 key points** from your article, comparing each side by side:

1. **Missing Sort Keys vs Proper Sort Keys**
   - ❌ Relational: Only PK, forces GSI creation
   - ✅ Single Table: PK + SK enables efficient queries

2. **Specific Naming vs Generic Naming**
   - ❌ Relational: Specific field names (userId, email)
   - ✅ Single Table: Generic PK/SK patterns

3. **GSI Necessity vs Strategic GSI Usage**
   - ❌ Relational: Forced GSI due to poor schema
   - ✅ Single Table: No GSI needed for frequently accessed patterns

4. **GSI Naming Anti-patterns vs Generic Names**
   - ❌ Relational: Descriptive names (PostsByDateIndex)
   - ✅ Single Table: Generic names (EntityTypeIndex for analytics only)

5. **Multiple Queries vs Single Query Efficiency**
   - ❌ Relational: Multiple queries for user + posts + comments + followers + likes
   - ✅ Single Table: Single query using PK=USER#userId with OR + begins_with for all entity types

6. **Inefficient Access Patterns vs Strategic Design**
   - ❌ Relational: Scan operations required
   - ✅ Single Table: Efficient GSI queries

## 🚀 Quick Start

### Prerequisites
- AWS credentials configured
- Infrastructure deployed (`make deploy` from root directory)

### Install Dependencies
```bash
pnpm install
```

### Run the Demonstration
```bash
pnpm start
```

## 📁 Project Structure

```
dynamo-queries/
├── base-dao.ts          # Common DynamoDB operations
├── relational-dao.ts    # Bad patterns (demonstrates the 6 points)
├── single-table-dao.ts  # Good patterns (solves the 6 points)
├── data-generator.ts    # Test data generation
├── test-service.ts      # Side-by-side comparison service
├── index.ts             # Main entry point
├── package.json         # Dependencies
└── tsconfig.json        # TypeScript configuration
```

## 🔍 How It Works

1. **Data Generation**: Creates test users and posts for both designs
2. **Side-by-Side Testing**: Runs identical operations on both designs
3. **Performance Comparison**: Shows latency and RCU differences
4. **Clear Explanation**: Explains why each pattern is good or bad

## 📊 Sample Output

```
🔍 Point 1: Missing Sort Keys vs Proper Sort Keys
============================================================

❌ BAD PATTERN - Relational Design:
   Table: posts-relational
   Schema: Only PK (userId), no sort key
   Problem: Cannot efficiently query by date range
   Result: 45ms, RCU: 0.5

✅ GOOD PATTERN - Single Table Design:
   Table: single-table-social
   Schema: PK (USER#userId) + SK (POST#postId#date)
   Solution: Can efficiently query by userId + date range
   Result: 23ms, RCU: 0.3

📊 Performance Comparison:
   Latency: Faster by 22ms (48.9%)
   RCU: Lower by 0.2 (40.0%)
   🎯 Single Table Design is BETTER!
```

## 🛠️ Customization

- **Data Size**: Modify `generateTestData(5, 20)` in `test-service.ts`
- **Region**: Change region in DAO constructors
- **Table Names**: Update table names in DAO constructors

## 🔧 Troubleshooting

If you get errors:

1. **AWS Credentials**: Run `aws configure`
2. **Infrastructure**: Ensure tables exist with `make deploy`
3. **Dependencies**: Run `pnpm install`

## 📚 Key Takeaways

- **Single Table Design** eliminates GSI complexity for frequently accessed patterns
- **Generic PK/SK patterns** provide flexibility  
- **Proper key design** with PK=USER#userId naturally groups all user data
- **Single query efficiency** using OR + begins_with for all entity types
- **No GSI needed** for frequently accessed patterns - pure efficiency!
- **Strategic schema design** enables efficient queries without unnecessary complexity

This demonstration makes it crystal clear why Single Table Design is superior for DynamoDB applications! 