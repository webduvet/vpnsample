#!/bin/bash

# --- adjust these ---
STACK=ice-sim
REGION=eu-west-1                # or your region
PROFILE=dev                     # omit if using default profile

# From your hub VPN config download (the VGW config):
TUN1_OUTSIDE_IP=52.19.212.207   # <-- replace with "Outside IP Address" for Tunnel 1
TUN2_OUTSIDE_IP=54.76.232.206   # <-- replace with "Outside IP Address" for Tunnel 2

# Optional: prefixes/port (defaults shown)
ICE_PUBLIC_PREFIX=158.224.40.0/24
BACKEND_PRIVATE_PREFIX=10.200.1.0/24
BACKEND_PORT=8080

# Enter PSKs securely (won't be stored in shell history)
# read -s -p "Enter PSK for Tunnel 1: " PSK1; echo
# read -s -p "Enter PSK for Tunnel 2: " PSK2; echo
#
PSK1=3o9sCsWk5RqX3IF5Lhg2a84hlxychSBBxx6xrYbQB9nVPBNC
PSK2=CzDhyjWefAJyc3XbyVGOkq9w2TiWKc0MaOm8noOrOWir2mHO
