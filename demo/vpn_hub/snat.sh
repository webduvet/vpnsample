#!/bin/bash
set -eu

# sysctl for forwarding & NAT friendliness
cat >> /etc/sysctl.d/99-nat.conf <<'EOF'
net.ipv4.ip_forward=1
net.ipv4.conf.all.rp_filter=0
net.ipv4.conf.default.rp_filter=0
EOF
sysctl -p /etc/sysctl.d/99-nat.conf

apt-get update -y
apt-get install -y iptables-persistent

# VARIABLES
SNAT_IP="10.100.10.10"            # the egress IP you gave ICE (or one from a small pool)
ICE_CIDRS=("158.224.40.0/24")     # add all ICE prefixes here

# Flush then set SNAT (no port translation) toward ICE
iptables -t nat -F POSTROUTING
for NET in "${ICE_CIDRS[@]}"; do
  iptables -t nat -A POSTROUTING -d "$NET" -j SNAT --to-source "$SNAT_IP"
done

netfilter-persistent save
