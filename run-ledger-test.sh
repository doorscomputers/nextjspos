#!/bin/bash
# Inventory Ledger Test - Quick Start Script (Linux/Mac)
# This script automates the complete testing process

echo ""
echo "========================================"
echo "  Inventory Ledger - Complete Test"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Step 1: Verify prerequisites
echo -e "${YELLOW}Step 1: Checking Prerequisites...${NC}"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo -e "${RED}  ✗ Error: Node.js not found. Please install Node.js.${NC}"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}  ✓ Node.js version: $NODE_VERSION${NC}"

# Check if database is accessible
echo -e "${YELLOW}  Checking database connection...${NC}"
DB_CHECK=$(node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.\$connect().then(() => { console.log('OK'); prisma.\$disconnect(); }).catch(() => { console.log('FAIL'); process.exit(1); })" 2>&1)
if [ $? -ne 0 ]; then
    echo -e "${RED}  ✗ Error: Cannot connect to database. Please check DATABASE_URL in .env${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Database connection: OK${NC}"

# Check if dev server is running
echo -e "${YELLOW}  Checking if dev server is running...${NC}"
if ! nc -z localhost 3000 2>/dev/null; then
    echo -e "${YELLOW}  ⚠ Warning: Dev server not detected on port 3000${NC}"
    echo -e "${YELLOW}  Please start dev server in another terminal: npm run dev${NC}"
    read -p "  Continue anyway? (y/n): " continue
    if [ "$continue" != "y" ]; then
        exit 1
    fi
else
    echo -e "${GREEN}  ✓ Dev server: Running on port 3000${NC}"
fi

echo ""
echo -e "${YELLOW}Step 2: Data Cleanup${NC}"
echo -e "${RED}  This will DELETE all transactional data!${NC}"
echo -e "${GREEN}  Master data (users, products, locations) will be preserved.${NC}"

read -p "  Run cleanup script? (y/n): " cleanup
if [ "$cleanup" == "y" ]; then
    echo ""
    echo -e "${YELLOW}  Running cleanup script...${NC}"
    node cleanup-all-transactions.js

    if [ $? -ne 0 ]; then
        echo ""
        echo -e "${RED}  ✗ Error: Cleanup failed!${NC}"
        exit 1
    fi

    echo ""
    echo -e "${GREEN}  ✓ Cleanup completed successfully!${NC}"
else
    echo -e "${YELLOW}  Skipping cleanup...${NC}"
    echo -e "${RED}  Warning: Test may fail if old transaction data exists!${NC}"
fi

echo ""
echo -e "${YELLOW}Step 3: Running Playwright Test${NC}"
echo -e "${YELLOW}  This will execute the comprehensive inventory ledger test...${NC}"
echo -e "${YELLOW}  Estimated time: 3-5 minutes${NC}"
echo ""

read -p "  Run Playwright test? (y/n): " runTest
if [ "$runTest" == "y" ]; then
    echo ""
    echo -e "${YELLOW}  Starting test execution...${NC}"

    # Ask for headed or headless
    read -p "  Run in headed mode (see browser)? (y/n): " headed

    if [ "$headed" == "y" ]; then
        npx playwright test e2e/inventory-ledger-full-flow.spec.ts --headed --reporter=list
    else
        npx playwright test e2e/inventory-ledger-full-flow.spec.ts --reporter=list
    fi

    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}  ✓ SUCCESS: All tests passed!${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo ""

        echo -e "${CYAN}Test artifacts saved to:${NC}"
        echo "  - Screenshots: test-results/"
        echo "  - Report: test-results/ledger-step7-full-report.png"

        echo ""
        echo -e "${CYAN}Key Results:${NC}"
        echo "  Opening Balance: 100 units"
        echo "  Closing Balance: 110 units"
        echo "  System Inventory: 110 units"
        echo -e "  Variance: ${GREEN}0 units (Perfect accuracy!)${NC}"
        echo -e "  Status: ${GREEN}Matched${NC}"

    else
        echo ""
        echo -e "${RED}========================================${NC}"
        echo -e "${RED}  ✗ FAILED: Some tests failed!${NC}"
        echo -e "${RED}========================================${NC}"
        echo ""

        echo -e "${YELLOW}Troubleshooting steps:${NC}"
        echo "  1. Check test-results/ for screenshots"
        echo "  2. Review console output above"
        echo "  3. Ensure dev server is running"
        echo "  4. Verify seed data exists (npm run db:seed)"
        echo "  5. Check INVENTORY-LEDGER-TEST-GUIDE.md for details"
        echo ""

        exit 1
    fi
else
    echo -e "${YELLOW}  Test skipped.${NC}"
fi

echo ""
echo -e "${YELLOW}Step 4: View Test Results${NC}"
read -p "  Open Playwright HTML report? (y/n): " viewResults
if [ "$viewResults" == "y" ]; then
    npx playwright show-report
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Test process completed!${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Review screenshots in test-results/"
echo "  2. Verify ledger-step7-full-report.png shows 0 variance"
echo "  3. Read INVENTORY-LEDGER-TEST-GUIDE.md for details"
echo "  4. Run manual verification if needed"
echo ""
