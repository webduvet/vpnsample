
# 0) Keep your routes as-is (10.100.2.0/27 via vti0) ✅

# 1) (Optional) clear any old iptables nat to avoid confusion
sudo iptables -t nat -F PREROUTING
sudo iptables -t nat -F POSTROUTING

# 2) Create nft nat table + chains (idempotent)
sudo nft 'add table ip nat' 2>/dev/null || true
sudo nft 'add chain ip nat prerouting { type nat hook prerouting priority -100; }' 2>/dev/null || true
sudo nft 'add chain ip nat postrouting { type nat hook postrouting priority 100; }' 2>/dev/null || true

# 3) Add NAT rules bound to vti0 (per-host first to prove path)
ICE_IP=203.0.113.246
BE_IP=10.200.1.246
sudo nft "add rule ip nat prerouting  iif vti0 ip daddr $ICE_IP tcp dport 8080 dnat to $BE_IP"
sudo nft "add rule ip nat postrouting oif vti0 ip saddr $BE_IP tcp sport 8080 snat to $ICE_IP"

# 4) Verify rules are present
sudo nft list ruleset | sed -n '/table ip nat/,$p'








#test:

# see decapped SYN on the tunnel (you already do)
sudo tcpdump -ni vti0 'dst 203.0.113.246 and tcp port 8080'

# now you SHOULD see the DNATed SYN toward the backend:
sudo tcpdump -ni ens5 'dst 10.200.1.246 and tcp port 8080'
