#!/bin/bash

# Do NOT set -e to allow cleanup to continue even if some resources are already deleted or fail to delete.

# Source environment variables
if [ -f "./env.sh" ]; then
  source ./env.sh
else
  echo "Error: env.sh file not found."
  exit 1
fi

PROXY_NAME="llm-budget-limits-v2"

if [ -z "$APIGEE_ORG" ] || [ -z "$APIGEE_ENV" ]; then
  echo "Error: Please set APIGEE_ORG, APIGEE_ENV in env.sh."
  exit 1
fi


echo "============================================================"
echo "Undeploying and Cleaning Up: $PROXY_NAME"
echo "Org: $APIGEE_ORG"
echo "Env: $APIGEE_ENV"
echo "============================================================"

# Check if apigeecli is installed
if ! command -v apigeecli &> /dev/null; then
    echo "apigeecli not found. Installing..."
    curl -s https://raw.githubusercontent.com/apigee/apigeecli/main/downloadLatest.sh | bash
    export PATH=$PATH:$HOME/.apigeecli/bin
fi

APP_NAME="llm-budget-all-app"
DEV_EMAIL="budget-all-dev@example.com"

echo "Deleting Developer App: $APP_NAME"
apigeecli apps delete --name "$APP_NAME" --id "$DEV_EMAIL" --org "$APIGEE_ORG" --default-token || echo "Warning: Failed to delete app $APP_NAME"


echo "Deleting Developer: $DEV_EMAIL"
apigeecli developers delete --email "$DEV_EMAIL" --org "$APIGEE_ORG" --default-token || echo "Warning: Failed to delete developer $DEV_EMAIL"

echo "Deleting API Products..."
apigeecli products delete --name llm-budget-all-bronze --org "$APIGEE_ORG" --default-token || echo "Warning: Failed to delete product llm-budget-all-bronze"
apigeecli products delete --name llm-budget-all-silver --org "$APIGEE_ORG" --default-token || echo "Warning: Failed to delete product llm-budget-all-silver"

echo "Undeploying API Proxy..."
apigeecli apis undeploy --name "$PROXY_NAME" --env "$APIGEE_ENV" --org "$APIGEE_ORG" --default-token || echo "Warning: Failed to undeploy proxy $PROXY_NAME"

echo "Deleting API Proxy..."
apigeecli apis delete --name "$PROXY_NAME" --org "$APIGEE_ORG" --default-token || echo "Warning: Failed to delete proxy $PROXY_NAME"

echo "Deleting Cloud Run Service: llm-budget-ui-v2"
gcloud run services delete "llm-budget-ui-v2" --region "us-central1" --project "$PROJECT_ID" --quiet || echo "Warning: Failed to delete Cloud Run service llm-budget-ui-v2"

SA_NAME="llm-budget-limits-v2-svc-acct"
SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
echo "Deleting Service Account: $SA_EMAIL"
gcloud iam service-accounts delete "$SA_EMAIL" --project "$PROJECT_ID" --quiet || echo "Warning: Failed to delete service account $SA_EMAIL"

echo "============================================================"
echo "Cleanup completed!"
echo "============================================================"
