# Set environment variables for migration
$env:SOURCE_DATABASE_URL = "postgresql://postgres:Seepeeyusss999%21%40%23@localhost:5432/ultimatepos_modern"
# Use SESSION POOLER (port 5432) with pgbouncer mode
$env:TARGET_DATABASE_URL = "postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?pgbouncer=true"

# Run migration
npm run migrate:table-by-table
