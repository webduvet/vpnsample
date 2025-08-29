#!/bin/bash

aws cloudformation udpate \
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
