# Vercel Database Setup Instructions

## Step 1: Install Vercel CLI (if not already installed)

```bash
npm install -g vercel
```

## Step 2: Login to Vercel

```bash
vercel login
```

## Step 3: Link Your Local Project to Vercel

```bash
cd C:\xampp\htdocs\ultimatepos-modern
vercel link
```

Follow the prompts:
- Set up and deploy? **N** (No, we just want to link)
- Which scope? Select your account
- Link to existing project? **Y** (Yes)
- What's the name of your existing project? **ultimatepos-modern** (or your project name)

## Step 4: Pull Production Environment Variables

```bash
vercel env pull .env.production
```

This downloads your production environment variables to a local `.env.production` file.

## Step 5: Push Database Schema to Production

```bash
# Set the environment to use production database
set DATABASE_URL=<your-production-database-url>

# Push schema to production database
npx prisma db push

# Verify the schema
npx prisma studio
```

## Step 6: Seed Production Database (IMPORTANT)

After pushing the schema, seed your production database with the demo accounts and default data:

```bash
npm run db:seed
```

This will create:
- Default business account
- Super Admin user (username: `superadmin`, password: `password`)
- Admin, Manager, and Cashier demo accounts
- Default roles and permissions
- Sample data

**SECURITY NOTE**: After deployment, you should:
1. Login as superadmin
2. Change the default password immediately
3. Create your actual admin account
4. Delete or disable the demo accounts

## Step 7: Verify Deployment

Visit your deployed application:
```
https://your-project.vercel.app/login
```

Login with:
- **Username**: `superadmin`
- **Password**: `password`

## Common Issues

### Issue 1: Database Connection Timeout
**Solution**: Ensure your DATABASE_URL uses connection pooling if using Supabase:
```
postgresql://user:pass@host:6543/postgres?pgbouncer=true
```

### Issue 2: Prisma Client Out of Sync
**Solution**: Run in your project directory:
```bash
npx prisma generate
git add .
git commit -m "chore: regenerate Prisma client"
git push origin master
```
Vercel will auto-deploy the update.

### Issue 3: Build Fails with "Cannot find module '@prisma/client'"
**Solution**: Ensure your package.json has a postinstall script:
```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

### Issue 4: Environment Variables Not Loading
**Solution**:
1. Go to Vercel Dashboard > Your Project > Settings > Environment Variables
2. Ensure all variables are set for the "Production" environment
3. Redeploy: Vercel Dashboard > Deployments > Click "..." > Redeploy

## Updating Production Database Schema

When you make changes to `prisma/schema.prisma`:

1. Commit and push changes to GitHub
2. In your local terminal:
   ```bash
   vercel env pull .env.production
   npx prisma db push
   ```
3. Vercel will auto-deploy the code changes

## Custom Domain Setup (Optional)

1. Go to Vercel Dashboard > Your Project > Settings > Domains
2. Add your custom domain (e.g., `pos.yourdomain.com`)
3. Follow the DNS configuration instructions
4. Update environment variables:
   ```
   NEXTAUTH_URL=https://pos.yourdomain.com
   NEXT_PUBLIC_APP_URL=https://pos.yourdomain.com
   ```
5. Redeploy from Vercel Dashboard

## Monitoring and Logs

- **View Logs**: Vercel Dashboard > Your Project > Deployments > Select Deployment > Function Logs
- **Analytics**: Vercel Dashboard > Your Project > Analytics
- **Speed Insights**: Vercel Dashboard > Your Project > Speed Insights
