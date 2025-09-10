#!/bin/bash
# Usage: source ./setup.sh to load environment variables for deploy.sh and update.sh

# --- adjust these ---
export STACK=ice-sim
export REGION=eu-west-1                # or your region
export PROFILE=dev                     # omit if using default profile

# From your hub VPN config download (the VGW config):
export TUN1_OUTSIDE_IP=52.211.164.164   # <-- replace with "Outside IP Address" for Tunnel 1
export TUN2_OUTSIDE_IP=54.217.2.73   # <-- replace with "Outside IP Address" for Tunnel 2

# Optional: prefixes/port (defaults shown)
export ICE_PUBLIC_PREFIX=203.0.113.0/24
export BACKEND_PRIVATE_PREFIX=10.200.1.0/24
export BACKEND_PORT=8080

# ipsec conf tunnels
export LEFT_SUBNET=10.100.2.0/27
export RIGHT_SUBNET=203.0.113.0/24

# Enter PSKs securely (won't be stored in shell history)
# read -s -p "Enter PSK for Tunnel 1: " PSK1; echo
# read -s -p "Enter PSK for Tunnel 2: " PSK2; echo
#
# simulated only Mahwah
export PSK1=jpLjsf7DeDTMVagrCjXOjCX7LiL7baG5dgYREVbafjNOupyY
export PSK2=k3NSuR5Iskoj5MElebh9WdsQdZH2j6JVX3j75rZVAedkE1Tl

