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

PROXY_NAME="llm-budget-limits-v2"

if [ -z "$APIGEE_ORG" ] || [ -z "$APIGEE_ENV" ]; then
  echo "Error: Please set APIGEE_ORG, APIGEE_ENV in env.sh."
  exit 1
fi


echo "============================================================"
echo "Deploying API Proxy: $PROXY_NAME"
echo "Org: $APIGEE_ORG"
echo "Env: $APIGEE_ENV"
echo "============================================================"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed. Please install jq."
    exit 1
fi

# Check if apigeecli is installed
if ! command -v apigeecli &> /dev/null; then
    echo "apigeecli not found. Installing..."
    curl -s https://raw.githubusercontent.com/apigee/apigeecli/main/downloadLatest.sh | bash
    export PATH=$PATH:$HOME/.apigeecli/bin
fi

echo "Creating API Proxy bundle..."
REV=$(apigeecli apis create bundle -f apiproxy -n "$PROXY_NAME" --org "$APIGEE_ORG" --default-token --disable-check | jq -r '.revision')

if [ -z "$REV" ] || [ "$REV" == "null" ]; then
  echo "Error: Failed to create bundle or extract revision."
  exit 1
fi

echo "Deploying revision $REV..."
DEPLOY_CMD="apigeecli apis deploy --wait --name \"$PROXY_NAME\" --ovr --rev \"$REV\" --org \"$APIGEE_ORG\" --env \"$APIGEE_ENV\" --default-token"
if [ -n "$PROXY_SERVICE_ACCOUNT" ]; then
  DEPLOY_CMD="$DEPLOY_CMD --sa \"$PROXY_SERVICE_ACCOUNT\""
fi
eval $DEPLOY_CMD

echo "Creating API Products..."
apigeecli products create --name llm-budget-all-bronze --display-name "LLM Budget All Bronze" --envs "$APIGEE_ENV" --approval auto --opgrp ./product-bronze.json --org "$APIGEE_ORG" --default-token
apigeecli products create --name llm-budget-all-silver --display-name "LLM Budget All Silver" --envs "$APIGEE_ENV" --approval auto --opgrp ./product-silver.json --org "$APIGEE_ORG" --default-token

echo "Creating Developer..."
DEV_EMAIL="budget-all-dev@example.com"
apigeecli developers create --user budget-all-dev --email "$DEV_EMAIL" --first BudgetAll --last Developer --org "$APIGEE_ORG" --default-token

echo "Creating Developer App and subscribing to llm-budget-all-bronze..."
APP_NAME="llm-budget-all-app"
apigeecli apps create --name "$APP_NAME" --email "$DEV_EMAIL" --prods llm-budget-all-bronze --org "$APIGEE_ORG" --default-token --disable-check

echo "Subscribing App to llm-budget-all-silver (generating new key)..."
apigeecli apps genkey --name "$APP_NAME" -d "$DEV_EMAIL" --prods llm-budget-all-silver --org "$APIGEE_ORG" --default-token --disable-check

echo "Fetching API Keys..."
# Robust jq filter to handle both array and object output
BRONZE_KEY=$(apigeecli apps get --name "$APP_NAME" --org "$APIGEE_ORG" --default-token --disable-check | jq -r 'if type == "array" then .[0] else . end | .credentials[] | select(.apiProducts[].apiproduct=="llm-budget-all-bronze") | .consumerKey')
SILVER_KEY=$(apigeecli apps get --name "$APP_NAME" --org "$APIGEE_ORG" --default-token --disable-check | jq -r 'if type == "array" then .[0] else . end | .credentials[] | select(.apiProducts[].apiproduct=="llm-budget-all-silver") | .consumerKey')

echo "============================================================"
echo "Deployment and Setup Completed!"
echo "API Proxy: $PROXY_NAME"
echo "API Products: llm-budget-all-bronze, llm-budget-all-silver"
echo "Bronze API Key: $BRONZE_KEY"
echo "Silver API Key: $SILVER_KEY"
echo "============================================================"
