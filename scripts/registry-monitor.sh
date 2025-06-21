#!/bin/bash
# To run: ./registry-monitor.sh
echo "📊 DigitalOcean Container Registry Storage Monitor"
echo "================================================"

# Check current registry usage
echo "🔍 Current registry status:"
doctl registry get

echo ""
echo "📦 Repository details:"
doctl registry repository list

echo ""
echo "🏷️ Current tags in artshare-backend:"
doctl registry repository list-tags artshare-backend --format Tag,CompressedSizeBytes,UpdatedAt

echo ""
echo "📈 Storage usage breakdown:"
# Get total storage used
TOTAL_STORAGE=$(doctl registry get --format StorageUsageBytes --no-header)
TOTAL_STORAGE_MB=$((TOTAL_STORAGE / 1024 / 1024))

# Count number of images (excluding latest since it's usually a duplicate)
IMAGE_COUNT=$(doctl registry repository list-tags artshare-backend --format Tag --no-header | grep -v "latest" | wc -l)
AVG_SIZE_MB=$((TOTAL_STORAGE_MB / (IMAGE_COUNT + 1)))  # +1 for latest

echo "Total storage used: ${TOTAL_STORAGE_MB} MB"
echo "Number of images: $((IMAGE_COUNT + 1)) (including latest)"
echo "Average image size: ${AVG_SIZE_MB} MB (~1.6GB expected)"

# Storage recommendations for large images
echo ""
echo "💡 Storage recommendations for Basic plan ($5/mo, 5GB) with 1.6GB images:"
echo "MAXIMUM: latest + 1 recent = ~3.2GB (safe)"
echo "TIGHT: latest + 2 recent = ~4.8GB (96% full - risky!)"
echo "IMPOSSIBLE: latest + 3+ recent = exceeds 5GB limit"

# Check plan limits with Basic plan focus
if [ $TOTAL_STORAGE_MB -lt 3200 ]; then
    echo "✅ SAFE: Using ${TOTAL_STORAGE_MB}MB of 5GB Basic plan (under 3.2GB target)"
elif [ $TOTAL_STORAGE_MB -lt 4800 ]; then
    echo "⚠️ CAUTION: Using ${TOTAL_STORAGE_MB}MB of 5GB Basic plan (approaching limit)"
    echo "💡 Consider running cleanup soon"
elif [ $TOTAL_STORAGE_MB -lt 5120 ]; then
    echo "🚨 DANGER: Using ${TOTAL_STORAGE_MB}MB of 5GB Basic plan (very close to limit!)"
    echo "🚨 URGENT: Run cleanup immediately or risk overage charges"
else
    echo "💸 OVERAGE: Using ${TOTAL_STORAGE_MB}MB - EXCEEDING 5GB Basic plan!"
    echo "💰 Cost: $5 + $0.02 per GB over = $(echo "scale=2; 5 + (${TOTAL_STORAGE_MB} - 5120) * 0.02 / 1024" | bc)"
    echo "🚨 IMMEDIATE ACTION REQUIRED"
fi

# Basic plan specific warnings
BASIC_PERCENT=$((TOTAL_STORAGE_MB * 100 / 5120))
echo ""
echo "📊 Basic plan usage: ${BASIC_PERCENT}%"

if [ $BASIC_PERCENT -gt 90 ]; then
    echo "🚨 CRITICAL: Over 90% of Basic plan used!"
elif [ $BASIC_PERCENT -gt 75 ]; then
    echo "⚠️ WARNING: Over 75% of Basic plan used"
elif [ $BASIC_PERCENT -gt 60 ]; then
    echo "💡 INFO: Over 60% of Basic plan used - monitor closely"
fi

# Calculate percentage of various plan limits
STARTER_PERCENT=$((TOTAL_STORAGE_MB * 100 / 500))
BASIC_PERCENT=$((TOTAL_STORAGE_MB * 100 / 5120))
PROFESSIONAL_PERCENT=$((TOTAL_STORAGE_MB * 100 / 102400))

echo ""
echo "📊 Plan usage percentages:"
echo "Starter (500 MB): ${STARTER_PERCENT}%"
echo "Basic (5 GB): ${BASIC_PERCENT}%"
echo "Professional (100 GB): ${PROFESSIONAL_PERCENT}%"

# Warning thresholds
if [ $BASIC_PERCENT -gt 80 ] && [ $BASIC_PERCENT -lt 100 ]; then
    echo "⚠️ WARNING: Approaching Basic plan limit!"
fi

if [ $PROFESSIONAL_PERCENT -gt 80 ] && [ $PROFESSIONAL_PERCENT -lt 100 ]; then
    echo "⚠️ WARNING: Approaching Professional plan limit!"
fi

echo ""
echo "🛠️ Ultra-aggressive cleanup commands (no rollback needed):"
echo "OPTIMAL cleanup (keep only latest): doctl registry repository list-tags artshare-backend | grep -v latest | awk '{print \$1}' | xargs -I {} doctl registry repository delete-tag artshare-backend {} --force"
echo "Delete untagged: doctl registry repository delete-manifest artshare-backend --force"
echo "Garbage collect: doctl registry garbage-collection start --force"
echo ""
echo "💡 Recommended: Keep only 'latest' tag for maximum space efficiency with Basic plan"