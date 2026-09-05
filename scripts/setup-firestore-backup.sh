#!/usr/bin/env bash
# =============================================================================
# NACS PLATFORM - DISASTER RECOVERY AUTOMATION
# Scheduled Firestore Export to Cloud Storage
# =============================================================================

set -e

PROJECT_ID=${1:-"nacs-platform-prod"}
BACKUP_BUCKET=${2:-"gs://${PROJECT_ID}-backups"}
LOCATION="europe-west1"

echo "Configuring Firestore Scheduled Export for project: ${PROJECT_ID}..."
echo "Target Backup Bucket: ${BACKUP_BUCKET}"

# 1. Enable Required Google Cloud APIs
echo "Enabling Firestore, Cloud Scheduler, and Cloud Storage APIs..."
gcloud services enable firestore.googleapis.com \
  cloudscheduler.googleapis.com \
  storage.googleapis.com \
  --project="${PROJECT_ID}"

# 2. Create Storage Bucket for Backups (with Lifecycle Rule)
echo "Ensuring backup storage bucket exists..."
if ! gsutil ls -b "${BACKUP_BUCKET}" 2>/dev/null; then
  gsutil mb -p "${PROJECT_ID}" -c standard -l "${LOCATION}" "${BACKUP_BUCKET}"
  echo "Bucket created."
fi

# Apply 30-day retention lifecycle to avoid unbounded storage costs
cat <<EOF > /tmp/lifecycle.json
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {"age": 30}
    }
  ]
}
EOF
gsutil lifecycle set /tmp/lifecycle.json "${BACKUP_BUCKET}"

# 3. Grant Firestore Service Account permissions to write to bucket
SERVICE_ACCOUNT=$(gcloud projects get-iam-policy "${PROJECT_ID}" \
  --format="json" | grep -o '[^"]*@appspot.gserviceaccount.com' | head -n 1)

if [ -n "${SERVICE_ACCOUNT}" ]; then
  echo "Granting storage admin permissions to service account: ${SERVICE_ACCOUNT}"
  gsutil iam ch "serviceAccount:${SERVICE_ACCOUNT}:roles/storage.admin" "${BACKUP_BUCKET}"
fi

echo "Firestore automated backup setup script complete."
echo "Daily backups are also executed via functions/src/backup/scheduled-backup.ts at 03:00 AM Africa/Algiers."
