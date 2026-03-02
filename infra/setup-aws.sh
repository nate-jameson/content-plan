#!/bin/bash
set -e

REGION="us-west-2"
VPC_ID="vpc-156a526d"
DB_NAME="content_review"
DB_USER="dashboard_admin"
DB_PASS="CrDash2026!Secure#Pg"
PROJECT="content-review"

echo "=== Content Review Dashboard — AWS Infrastructure Setup ==="
echo "Region: $REGION | VPC: $VPC_ID"
echo ""

# --- Step 1: Discover subnets in the VPC ---
echo ">>> Step 1: Discovering subnets in VPC..."
SUBNETS=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'Subnets[*].SubnetId' \
  --output text \
  --region $REGION)

SUBNET_COUNT=$(echo $SUBNETS | wc -w)
echo "Found $SUBNET_COUNT subnets: $SUBNETS"

if [ "$SUBNET_COUNT" -lt 2 ]; then
  echo "ERROR: Aurora requires at least 2 subnets in different AZs"
  echo "Available subnets and their AZs:"
  aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --query 'Subnets[*].[SubnetId,AvailabilityZone]' \
    --output table \
    --region $REGION
  exit 1
fi

# --- Step 2: Create Security Group ---
echo ""
echo ">>> Step 2: Creating security group..."
SG_ID=$(aws ec2 create-security-group \
  --group-name "${PROJECT}-aurora-sg" \
  --description "Content Review Dashboard - Aurora Serverless v2" \
  --vpc-id $VPC_ID \
  --region $REGION \
  --query 'GroupId' \
  --output text 2>/dev/null || \
  aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=${PROJECT}-aurora-sg" "Name=vpc-id,Values=$VPC_ID" \
    --query 'SecurityGroups[0].GroupId' \
    --output text \
    --region $REGION)

echo "Security Group: $SG_ID"

# Allow PostgreSQL from anywhere (needed for Vercel serverless)
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 5432 \
  --cidr 0.0.0.0/0 \
  --region $REGION 2>/dev/null || echo "  (ingress rule already exists)"

# --- Step 3: Create DB Subnet Group ---
echo ""
echo ">>> Step 3: Creating DB subnet group..."
SUBNET_IDS=$(echo $SUBNETS | tr ' ' '\n' | head -4 | tr '\n' ' ')
aws rds create-db-subnet-group \
  --db-subnet-group-name "${PROJECT}-subnets" \
  --db-subnet-group-description "Content Review Dashboard subnets" \
  --subnet-ids $SUBNET_IDS \
  --region $REGION 2>/dev/null || echo "  (subnet group already exists)"

echo "DB Subnet Group: ${PROJECT}-subnets"

# --- Step 4: Create Aurora Serverless v2 Cluster ---
echo ""
echo ">>> Step 4: Creating Aurora Serverless v2 cluster..."
aws rds create-db-cluster \
  --db-cluster-identifier "${PROJECT}-cluster" \
  --engine aurora-postgresql \
  --engine-version "16.4" \
  --database-name $DB_NAME \
  --master-username $DB_USER \
  --master-user-password "$DB_PASS" \
  --db-subnet-group-name "${PROJECT}-subnets" \
  --vpc-security-group-ids $SG_ID \
  --serverless-v2-scaling-configuration MinCapacity=0.5,MaxCapacity=4 \
  --storage-encrypted \
  --backup-retention-period 7 \
  --region $REGION 2>/dev/null && echo "Cluster creation initiated!" || echo "  (cluster may already exist)"

# --- Step 5: Create Aurora Instance ---
echo ""
echo ">>> Step 5: Creating Aurora Serverless v2 instance..."
aws rds create-db-instance \
  --db-instance-identifier "${PROJECT}-instance-1" \
  --db-cluster-identifier "${PROJECT}-cluster" \
  --db-instance-class db.serverless \
  --engine aurora-postgresql \
  --publicly-accessible \
  --region $REGION 2>/dev/null && echo "Instance creation initiated!" || echo "  (instance may already exist)"

# --- Step 6: Create S3 Bucket ---
echo ""
echo ">>> Step 6: Creating S3 bucket for PDF reports..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET_NAME="${PROJECT}-reports-${ACCOUNT_ID}"

aws s3api create-bucket \
  --bucket $BUCKET_NAME \
  --region $REGION \
  --create-bucket-configuration LocationConstraint=$REGION 2>/dev/null || echo "  (bucket may already exist)"

# Block all public access
aws s3api put-public-access-block \
  --bucket $BUCKET_NAME \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true \
  --region $REGION 2>/dev/null

# Lifecycle rule - expire reports after 90 days
aws s3api put-bucket-lifecycle-configuration \
  --bucket $BUCKET_NAME \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "ExpireOldReports",
      "Status": "Enabled",
      "Expiration": {"Days": 90},
      "Filter": {"Prefix": ""}
    }]
  }' \
  --region $REGION 2>/dev/null

echo "S3 Bucket: $BUCKET_NAME"

# --- Step 7: Wait for cluster to be available ---
echo ""
echo ">>> Step 7: Waiting for Aurora cluster to become available..."
echo "  (This can take 5-10 minutes...)"
aws rds wait db-cluster-available \
  --db-cluster-identifier "${PROJECT}-cluster" \
  --region $REGION

# --- Step 8: Get connection details ---
echo ""
echo ">>> Step 8: Retrieving connection details..."
ENDPOINT=$(aws rds describe-db-clusters \
  --db-cluster-identifier "${PROJECT}-cluster" \
  --query 'DBClusters[0].Endpoint' \
  --output text \
  --region $REGION)

PORT=$(aws rds describe-db-clusters \
  --db-cluster-identifier "${PROJECT}-cluster" \
  --query 'DBClusters[0].Port' \
  --output text \
  --region $REGION)

echo ""
echo "============================================"
echo "  ✅ INFRASTRUCTURE READY"
echo "============================================"
echo ""
echo "Aurora Cluster:  ${PROJECT}-cluster"
echo "Endpoint:        $ENDPOINT"
echo "Port:            $PORT"
echo "Database:        $DB_NAME"
echo "Username:        $DB_USER"
echo "S3 Bucket:       $BUCKET_NAME"
echo ""
echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@${ENDPOINT}:${PORT}/${DB_NAME}?sslmode=require"
echo ""
echo "Add this to your Vercel environment variables!"
echo "============================================"
