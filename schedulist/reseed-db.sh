#!/bin/bash

# Reseed Database Script
# This script will drop and recreate the database with fresh seed data

echo "🔄 Reseeding Database..."
echo ""
echo "⚠️  WARNING: This will delete ALL existing data!"
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

# Navigate to the backend directory
cd schedulist

echo "📦 Dropping existing database..."
npm run db:drop

echo "🏗️  Creating fresh database..."
npm run db:create

echo "🔧 Running migrations..."
npm run db:migrate

echo "🌱 Seeding database with test data..."
npm run db:seed

echo ""
echo "✅ Database reseeded successfully!"
echo ""
echo "📝 Test Accounts:"
echo "=================="
echo "Sunshine Therapy (Active):"
echo "  Admin:     admin@sunshine.com / Password123"
echo "  BCBA:      bcba@sunshine.com / Password123"
echo "  Therapist: therapist@sunshine.com / Password123"
echo ""
echo "Healing Hearts (Expiring):"
echo "  Admin:     admin@hearts.com / Password123"
echo "  BCBA:      bcba@hearts.com / Password123"
echo "  Therapist: therapist@hearts.com / Password123"
echo ""
echo "Coastal Behavior (Inactive):"
echo "  Admin:     admin@coastal.com / Password123"
echo "  BCBA:      bcba@coastal.com / Password123"
echo "  Therapist: therapist@coastal.com / Password123"