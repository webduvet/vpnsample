#!/bin/bash

REGION=eu-west-1
STACK=ice-sim

# StrongSwan & Backend instance IDs
SSW_ID=$(aws ec2 describe-instances --region $REGION \
  --filters "Name=tag:Name,Values=ICE-Sim-strongSwan" "Name=instance-state-name,Values=running" \
  --query "Reservations[0].Instances[0].InstanceId" --output text)

BE_ID=$(aws ec2 describe-instances --region $REGION \
  --filters "Name=tag:Name,Values=ICE-Sim-Backend" "Name=instance-state-name,Values=running" \
  --query "Reservations[0].Instances[0].InstanceId" --output text)

# Backend private IP (we'll curl this from the strongSwan box)
BE_IP=$(aws ec2 describe-instances --region $REGION --instance-ids $BE_ID \
  --query "Reservations[0].Instances[0].PrivateIpAddress" --output text)

echo "StrongSwan: $SSW_ID"
echo "Backend:    $BE_ID ($BE_IP)"
