#!/bin/bash

# Script to reset and reseed the database
# This will fix the encryption issues by creating fresh data with the current encryption key

echo "=== Database Reset and Reseed Script ==="
echo ""
echo "⚠️  WARNING: This will DELETE ALL DATA in your database!"
echo "Make sure your .env file has the correct DB_PASS value."
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

cd schedulist

echo ""
echo "1. Dropping and recreating database..."
npm run db:init

echo ""
echo "2. Seeding database with fresh data..."
npm run db:seed

echo ""
echo "✅ Database reset complete!"
echo ""
echo "Default credentials:"
echo "Admin: admin@sunshine.com / password123"
echo "BCBA: bcba1@sunshine.com / password123"
echo "Therapist: therapist1@sunshine.com / password123"
echo ""
echo "All patient data is now encrypted with your current ENCRYPTION_KEY."