# Set environment variables for Supabase
$env:DATABASE_URL = "postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?pgbouncer=true"

# Add demo users to Supabase
npm run db:add-demo-users
