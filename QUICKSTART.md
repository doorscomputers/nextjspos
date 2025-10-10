# ⚡ Quick Start Guide

Get UltimatePOS Modern running in 5 minutes!

## Step 1: Install PostgreSQL (Windows)

```bash
# Download from: https://www.postgresql.org/download/windows/
# During installation, remember your password!
```

**Or use existing MySQL:**
Update `.env` to use MySQL instead:
```env
DATABASE_URL="mysql://root:password@localhost:3306/ultimatepos_modern"
```

Update `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "mysql"  // Change from postgresql
  url      = env("DATABASE_URL")
}
```

## Step 2: Create Database

### PostgreSQL:
```bash
# Open Command Prompt as Administrator
psql -U postgres
```
```sql
CREATE DATABASE ultimatepos_modern;
\q
```

### MySQL (XAMPP):
```bash
# MySQL should already be running in XAMPP
# Open phpMyAdmin or use MySQL command line
mysql -u root -p
```
```sql
CREATE DATABASE ultimatepos_modern;
exit;
```

## Step 3: Configure Environment

Edit `.env` file:

**PostgreSQL:**
```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/ultimatepos_modern"
```

**MySQL:**
```env
DATABASE_URL="mysql://root:@localhost:3306/ultimatepos_modern"
```

## Step 4: Install & Setup

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Seed with demo data
npm run db:seed

# Start dev server
npm run dev
```

## Step 5: Login

Open http://localhost:3000

**Demo Accounts:**
- **Cashier**: `cashier` / `password`
- **Manager**: `manager` / `password`
- **Admin**: `admin` / `password`
- **Super Admin**: `superadmin` / `password`

## 🎉 Done!

Try logging in with different accounts to see role-based menus!

---

## Troubleshooting

**"Port 3000 already in use":**
```bash
# Kill the process or use different port
npm run dev -- -p 3001
```

**Database connection error:**
- Check PostgreSQL/MySQL is running
- Verify password in `.env`
- Check firewall settings

**"Module not found":**
```bash
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

- Explore the dashboard with different roles
- Check out `src/lib/rbac.ts` for permission system
- View database with `npm run db:studio`
- Read full README.md for deployment guide
