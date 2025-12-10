#!/bin/bash
# Backup script for Campus Cleanliness App
# Run this daily via cron: 0 2 * * * /path/to/backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
DB_PATH="./cleanliness.db"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Backup database
if [ -f "$DB_PATH" ]; then
    sqlite3 $DB_PATH ".backup $BACKUP_DIR/cleanliness_$DATE.db"
    echo "Backup completed: cleanliness_$DATE.db"
else
    echo "Error: Database file not found at $DB_PATH"
    exit 1
fi

# Keep only last 90 days of backups
find $BACKUP_DIR -name "cleanliness_*.db" -mtime +90 -delete

echo "Backup process completed at $(date)"

