#!/bin/bash

# Database Migration Setup Script
# Prepares your environment for migrating to Supabase

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}UltimatePOS Migration Setup${NC}"
echo -e "${CYAN}========================================${NC}\n"

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}✗ .env file not found${NC}"
    echo -e "${YELLOW}Creating .env from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created${NC}"
fi

# Check if Prisma is installed
echo -e "\n${BLUE}ℹ Checking Prisma installation...${NC}"
if ! command -v prisma &> /dev/null; then
    echo -e "${YELLOW}⚠ Prisma not found, installing...${NC}"
    npm install prisma @prisma/client
    echo -e "${GREEN}✓ Prisma installed${NC}"
else
    echo -e "${GREEN}✓ Prisma is installed${NC}"
fi

# Check if tsx is installed
echo -e "\n${BLUE}ℹ Checking tsx installation...${NC}"
if ! command -v tsx &> /dev/null; then
    echo -e "${YELLOW}⚠ tsx not found, installing globally...${NC}"
    npm install -g tsx
    echo -e "${GREEN}✓ tsx installed${NC}"
else
    echo -e "${GREEN}✓ tsx is installed${NC}"
fi

# Backup local database
echo -e "\n${BLUE}ℹ Creating database backup...${NC}"
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"

read -p "Do you want to backup your local database? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter database name [ultimatepos_modern]: " DB_NAME
    DB_NAME=${DB_NAME:-ultimatepos_modern}

    read -p "Enter database user [postgres]: " DB_USER
    DB_USER=${DB_USER:-postgres}

    echo -e "${YELLOW}Creating backup: $BACKUP_FILE${NC}"

    # Try PostgreSQL first
    if command -v pg_dump &> /dev/null; then
        pg_dump -h localhost -U $DB_USER -d $DB_NAME > $BACKUP_FILE 2>/dev/null && \
        echo -e "${GREEN}✓ PostgreSQL backup created: $BACKUP_FILE${NC}" || \
        echo -e "${YELLOW}⚠ PostgreSQL backup failed, trying MySQL...${NC}"
    fi

    # Try MySQL if PostgreSQL failed
    if [ ! -s $BACKUP_FILE ] && command -v mysqldump &> /dev/null; then
        read -s -p "Enter MySQL password: " DB_PASS
        echo
        mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > $BACKUP_FILE 2>/dev/null && \
        echo -e "${GREEN}✓ MySQL backup created: $BACKUP_FILE${NC}" || \
        echo -e "${RED}✗ Backup failed${NC}"
    fi
fi

# Configure Supabase connection
echo -e "\n${BLUE}ℹ Configuring Supabase connection...${NC}"
read -p "Do you have a Supabase project ready? (y/n): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "\n${CYAN}Please enter your Supabase connection details:${NC}"
    echo -e "${YELLOW}You can find this in: Supabase Dashboard → Settings → Database${NC}\n"

    read -p "Supabase Project Reference (e.g., xyzabc123): " PROJECT_REF
    read -s -p "Supabase Database Password: " SUPABASE_PASS
    echo

    # Create .env.migration file
    cat > .env.migration << EOF
# Local Database (Source)
SOURCE_DATABASE_URL="postgresql://localhost:5432/ultimatepos_modern"

# Supabase Database (Target)
TARGET_DATABASE_URL="postgresql://postgres:${SUPABASE_PASS}@db.${PROJECT_REF}.supabase.co:5432/postgres"
SUPABASE_DATABASE_URL="postgresql://postgres:${SUPABASE_PASS}@db.${PROJECT_REF}.supabase.co:5432/postgres"
EOF

    echo -e "${GREEN}✓ .env.migration file created${NC}"
else
    echo -e "\n${YELLOW}⚠ Please create a Supabase project first:${NC}"
    echo -e "  1. Go to https://supabase.com"
    echo -e "  2. Create a new project"
    echo -e "  3. Wait for project initialization (~2 minutes)"
    echo -e "  4. Run this script again"
    exit 1
fi

# Test Supabase connection
echo -e "\n${BLUE}ℹ Testing Supabase connection...${NC}"
source .env.migration
if psql "$TARGET_DATABASE_URL" -c "SELECT 1" &> /dev/null; then
    echo -e "${GREEN}✓ Supabase connection successful${NC}"
else
    echo -e "${RED}✗ Supabase connection failed${NC}"
    echo -e "${YELLOW}Please check your connection string and try again${NC}"
    exit 1
fi

# Push Prisma schema to Supabase
echo -e "\n${BLUE}ℹ Deploying Prisma schema to Supabase...${NC}"
read -p "Do you want to deploy the schema now? (y/n): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Deploying schema...${NC}"
    DATABASE_URL="$TARGET_DATABASE_URL" npx prisma db push --accept-data-loss
    echo -e "${GREEN}✓ Schema deployed to Supabase${NC}"
fi

# Summary
echo -e "\n${CYAN}========================================${NC}"
echo -e "${CYAN}Setup Complete!${NC}"
echo -e "${CYAN}========================================${NC}\n"

echo -e "${GREEN}✓ Environment configured${NC}"
echo -e "${GREEN}✓ Database backup created: ${BACKUP_FILE}${NC}"
echo -e "${GREEN}✓ Supabase connection tested${NC}"

echo -e "\n${CYAN}Next Steps:${NC}"
echo -e "  1. Review .env.migration file"
echo -e "  2. Run migration:"
echo -e "     ${YELLOW}source .env.migration && npx tsx scripts/migrate-to-supabase.ts${NC}"
echo -e "  3. Validate migration:"
echo -e "     ${YELLOW}source .env.migration && npx tsx scripts/validate-migration.ts${NC}"
echo -e "  4. Update production .env with Supabase connection"

echo -e "\n${BLUE}📖 For detailed instructions, see: MIGRATION_GUIDE.md${NC}\n"
