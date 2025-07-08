#!/bin/bash

# Simple Reseed Script - Just runs the seed data
echo "🌱 Reseeding database with test data..."
cd schedulist
npm run db:seed

echo ""
echo "✅ Database reseeded successfully!"