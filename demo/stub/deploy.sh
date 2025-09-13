#!/bin/bash


STACK=ice-sim
REGION=eu-west-1                # or your region
PROFILE=dev                     # omit if using default profile

# From your hub VPN config download (the VGW config):
TUN1_OUTSIDE_IP=34.241.135.157   # <-- replace with "Outside IP Address" for Tunnel 1
TUN2_OUTSIDE_IP=54.154.160.81   # <-- replace with "Outside IP Address" for Tunnel 2

# Optional: prefixes/port (defaults shown)
ICE_PUBLIC_PREFIX=203.0.113.0/24
BACKEND_PRIVATE_PREFIX=10.200.1.0/24
BACKEND_PORT=8080

# ipsec conf tunnels
LEFT_SUBNET=10.100.2.0/27
RIGHT_SUBNET=203.0.113.0/24

# Enter PSKs securely (won't be stored in shell history)
# read -s -p "Enter PSK for Tunnel 1: " PSK1; echo
# read -s -p "Enter PSK for Tunnel 2: " PSK2; echo
#
# simulated only Mahwah
PSK1=k317jbKQXmGMCnzdfxz3Gtx4eKi55yWPJHvHA1CbteHOo8pe
PSK2=eMqNJ1MtXSzY6D2nZn8X2J6O8v8FDN9w5WqNgEtNOiOEKHBz


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
    BackendDemoPort="$BACKEND_PORT" \
    IkeVersion="ikev2"
