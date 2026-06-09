#!/bin/bash

# Exit on error
set -e

# Source environment variables
if [ -f "./env.sh" ]; then
  source ./env.sh
else
  echo "Error: env.sh file not found."
  exit 1
fi

if [ -z "$PROJECT_ID" ]; then
  echo "Error: Please set PROJECT_ID in env.sh."
  exit 1
fi

echo "Checking required APIs..."
ENABLED_APIS=$(gcloud services list --enabled --project="$PROJECT_ID" --format="value(config.name)")

APIS=(
  "run.googleapis.com"
  "cloudbuild.googleapis.com"
  "artifactregistry.googleapis.com"
  "iam.googleapis.com"
  "apigee.googleapis.com"
)

for api in "${APIS[@]}"; do
  if ! echo "$ENABLED_APIS" | grep -q "$api"; then
    echo "Enabling $api..."
    gcloud services enable "$api" --project="$PROJECT_ID"
  fi
done


SA_NAME="llm-budget-limits-v2-svc-acct"
SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

echo "Checking if Service Account exists: $SA_EMAIL"
if ! gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID" &>/dev/null; then
  echo "Creating Service Account: $SA_NAME"
  gcloud iam service-accounts create "$SA_NAME" --display-name "LLM Budget Quota Service Account" --project "$PROJECT_ID"
  echo "Granting roles..."
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$SA_EMAIL" --role "roles/apigee.admin" --condition=None &>/dev/null
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$SA_EMAIL" --role "roles/iam.serviceAccountUser" --condition=None &>/dev/null
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$SA_EMAIL" --role "roles/serviceusage.serviceUsageConsumer" --condition=None &>/dev/null
fi


echo "============================================================"
echo "Deploying llm-budget-ui-v2 to Cloud Run"
echo "Project: $PROJECT_ID"
echo "Region: us-central1"
echo "Service Account: $SA_EMAIL"
echo "============================================================"

# Deploy to Cloud Run using budget-ui directory as source
gcloud run deploy llm-budget-ui-v2 \
  --source budget-ui \
  --region us-central1 \
  --project $PROJECT_ID \
  --ingress all \
  --service-account $SA_EMAIL

echo "============================================================"
echo "Deployment completed successfully!"
echo "============================================================"
