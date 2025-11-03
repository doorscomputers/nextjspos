#!/bin/bash

# Fix businessId type conversion across all API routes
# Convert session.user.businessId (string) to parseInt(session.user.businessId) (number)

echo "🔧 Fixing businessId type conversions..."

# Pattern 1: const businessId = session.user.businessId
find src/app/api -type f -name "*.ts" -exec sed -i 's/const businessId = session\.user\.businessId/const businessId = parseInt(session.user.businessId)/g' {} +

# Pattern 2: const { businessId } = session.user
find src/app/api -type f -name "*.ts" -exec sed -i 's/const { businessId } = session\.user/const businessId = parseInt(session.user.businessId)/g' {} +

# Pattern 3: session.user.businessId used directly in queries
find src/app/api -type f -name "*.ts" -exec sed -i 's/businessId: session\.user\.businessId,/businessId: parseInt(session.user.businessId),/g' {} +

echo "✅ Fixed businessId type conversions!"
echo "📊 Files modified:"
find src/app/api -type f -name "*.ts" -newer scripts/fix-businessid-type.sh | wc -l
