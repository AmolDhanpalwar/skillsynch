#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Haptiq SkillSync — AWS Infrastructure Bootstrap
#
# Run this ONCE to set up the AWS resources required by the CD pipeline.
# Prerequisites:
#   - AWS CLI v2 configured with AdministratorAccess or equivalent
#   - jq installed  (brew install jq)
#   - Replace ALL <PLACEHOLDER> values below before running
#
# Usage:
#   chmod +x infra/setup.sh
#   ./infra/setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Configure these before running ───────────────────────────────────────────
ACCOUNT_ID="<YOUR_AWS_ACCOUNT_ID>"         # 12-digit AWS account ID
REGION="us-east-1"
GITHUB_ORG="<YOUR_GITHUB_ORG>"            # e.g. mycompany
GITHUB_REPO="<YOUR_GITHUB_REPO>"          # e.g. skillsync
VPC_ID="<YOUR_VPC_ID>"                    # e.g. vpc-0abc1234
SUBNET_IDS="<SUBNET_A>,<SUBNET_B>"        # Private subnets (comma-separated)
SECURITY_GROUP_ID="<YOUR_SG_ID>"          # SG allowing port 80 from ALB
ALB_TARGET_GROUP_ARN="<YOUR_TG_ARN>"      # ARN of the ALB target group
# ─────────────────────────────────────────────────────────────────────────────

echo "==> [1/9] Creating OIDC provider for GitHub Actions..."
# Safe to run multiple times — error if provider already exists is non-fatal
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --region "$REGION" 2>/dev/null || echo "    OIDC provider already exists, skipping."

echo "==> [2/9] Creating ECR repository..."
aws ecr create-repository \
  --repository-name skillsync-app \
  --region "$REGION" \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256 2>/dev/null || echo "    ECR repo already exists, skipping."

echo "==> [3/9] Creating task execution role (for ECS to pull ECR images + write logs)..."
aws iam create-role \
  --role-name skillsync-task-execution-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": { "Service": "ecs-tasks.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }]
  }' 2>/dev/null || echo "    Task execution role already exists, skipping."

aws iam attach-role-policy \
  --role-name skillsync-task-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

echo "==> [4/9] Creating GitHub Actions IAM role (OIDC)..."
# Substitute placeholders in the trust policy
TRUST_POLICY=$(sed \
  -e "s/<ACCOUNT_ID>/${ACCOUNT_ID}/g" \
  -e "s/<GITHUB_ORG>/${GITHUB_ORG}/g" \
  -e "s/<REPO_NAME>/${GITHUB_REPO}/g" \
  infra/iam-github-actions-trust-policy.json)

aws iam create-role \
  --role-name github-actions-skillsync \
  --assume-role-policy-document "$TRUST_POLICY" 2>/dev/null || echo "    GitHub Actions role already exists, skipping."

echo "==> [5/9] Attaching permissions policy to GitHub Actions role..."
PERMISSIONS_POLICY=$(sed \
  -e "s/<ACCOUNT_ID>/${ACCOUNT_ID}/g" \
  -e "s/<REGION>/${REGION}/g" \
  infra/iam-github-actions-permissions-policy.json)

aws iam put-role-policy \
  --role-name github-actions-skillsync \
  --policy-name skillsync-deploy \
  --policy-document "$PERMISSIONS_POLICY"

echo "==> [6/9] Creating ECS cluster..."
aws ecs create-cluster \
  --cluster-name skillsync-cluster \
  --capacity-providers FARGATE FARGATE_SPOT \
  --default-capacity-provider-strategy \
    capacityProvider=FARGATE,weight=1,base=1 \
  --region "$REGION" 2>/dev/null || echo "    Cluster already exists, skipping."

echo "==> [7/9] Creating CloudWatch log group..."
aws logs create-log-group \
  --log-group-name /ecs/skillsync-app \
  --region "$REGION" 2>/dev/null || echo "    Log group already exists, skipping."

aws logs put-retention-policy \
  --log-group-name /ecs/skillsync-app \
  --retention-in-days 30 \
  --region "$REGION"

echo "==> [8/9] Registering initial ECS task definition..."
TASK_DEF=$(sed \
  -e "s/<ACCOUNT_ID>/${ACCOUNT_ID}/g" \
  infra/task-definition.json)

aws ecs register-task-definition \
  --cli-input-json "$TASK_DEF" \
  --region "$REGION"

echo "==> [9/9] Creating ECS Fargate service..."
aws ecs create-service \
  --cluster skillsync-cluster \
  --service-name skillsync-service \
  --task-definition skillsync-app \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[${SUBNET_IDS}],securityGroups=[${SECURITY_GROUP_ID}],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=${ALB_TARGET_GROUP_ARN},containerName=skillsync-app,containerPort=80" \
  --health-check-grace-period-seconds 30 \
  --deployment-configuration "deploymentCircuitBreaker={enable=true,rollback=true},minimumHealthyPercent=100,maximumPercent=200" \
  --region "$REGION" 2>/dev/null || echo "    ECS service already exists, skipping."

echo ""
echo "=================================================================="
echo "  Bootstrap complete!"
echo "=================================================================="
echo ""
echo "  Next steps:"
echo "  1. Add these secrets to your GitHub repository:"
echo "       AWS_ACCOUNT_ID  = ${ACCOUNT_ID}"
echo "       VITE_SUPABASE_URL = (from Supabase dashboard)"
echo "       VITE_SUPABASE_ANON_KEY = (from Supabase dashboard)"
echo ""
echo "  2. Push to main to trigger the first deployment."
echo ""
echo "  IAM Role ARN for GitHub Actions OIDC:"
echo "    arn:aws:iam::${ACCOUNT_ID}:role/github-actions-skillsync"
echo "=================================================================="
