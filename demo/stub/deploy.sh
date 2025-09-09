#!/bin/bash

echo "Starting deployment script..."
set -e
# print all arguments passed to the script as environment variables
echo "Arguments passed to the script:"
echo "STACK: $STACK"
echo "REGION: $REGION"
echo "TUN1_OUTSIDE_IP: $TUN1_OUTSIDE_IP"
echo "TUN2_OUTSIDE_IP: $TUN2_OUTSIDE_IP"
echo "PSK1: $PSK1"
echo "PSK2: $PSK2"
echo "ICE_PUBLIC_PREFIX: $ICE_PUBLIC_PREFIX"
echo "BACKEND_PRIVATE_PREFIX: $BACKEND_PRIVATE_PREFIX"
echo "BACKEND_PORT: $BACKEND_PORT"
echo "Arguments printed."
echo "Deploying CloudFormation stack..."



aws cloudformation deploy \
  --stack-name "$STACK" \
  --template-file ./ice-sim.yaml \
  --region "$REGION" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    VgwTunnel1OutsideIp="$TUN1_OUTSIDE_IP" \
    VgwTunnel2OutsideIp="$TUN2_OUTSIDE_IP" \
    Tunnel1Psk="$PSK1" \
    Tunnel2Psk="$PSK2" \
    IcePublicPrefix="$ICE_PUBLIC_PREFIX" \
    BackendPrivatePrefix="$BACKEND_PRIVATE_PREFIX" \
    BackendDemoPort="$BACKEND_PORT"
