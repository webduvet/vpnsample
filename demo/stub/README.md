# ICE Simulator + Hub VPN – Build & Debug Guide

This README explains how to deploy the **ICE simulator** stack (Libreswan IPsec peer + 1:1 prefix NAT + demo backend), hook it up to your **hub (VGW)**, and debug end-to-end.

---

## What this sim does

* Spins up a small VPC with:

  * **Libreswan** EC2 in a **public subnet** with an **Elastic IP (EIP)** — acts like “ICE”.
  * **Backend EC2** in a **private subnet** running a tiny HTTP server (`:8080`).
* Implements **1:1 prefix NAT** using **NETMAP** so “ICE public” IPs (e.g., `203.0.113.0/24`) map to private backend IPs (`10.200.1.0/24`) host-for-host.
* Accepts **AWS VGW** IPsec tunnels from your **hub** (static routes).

> We use **203.0.113.0/24** (RFC5737) as a safe lab “public” prefix. In prod, replace with ICE’s real prefixes.

---

## Prerequisites

* AWS CLI v2 configured (`aws sts get-caller-identity` should work).
* IAM rights to create CloudFormation stacks, EC2, EIPs, and SSM Session.
* (Optional) Session Manager Plugin for `aws ssm start-session` or use AWS Console → Systems Manager → Session Manager.

---

## Deploy the simulator

1. **Save the template** from this repo as `ice-sim.yaml`.

2. **Choose a region** and **stack name**:

```bash
export REGION=eu-west-1
export STACK=ice-sim
```

3. **Create (or identify) a hub VPN connection** you’ll use for testing:

* Create a **Customer Gateway** on the hub with **IP = the sim EIP** (you’ll get it after deploy), then
* Create a **VPN connection** to your **VGW** (static routes), or reuse an existing one.

4. **Get the two AWS “outside IPs”** for that hub VPN connection (you can update them later if you don’t know yet):

```bash
export VPN_ID=vpn-xxxxxxxxxxxxxxxxx
aws ec2 describe-vpn-connections --region "$REGION" --vpn-connection-ids "$VPN_ID" \
  --query "VpnConnections[0].VgwTelemetry[].OutsideIpAddress" --output text
# returns two IPs; set them:
export TUN1=<first IP>
export TUN2=<second IP>
```

5. **Enter PSKs** (they must match what your hub uses for Tunnel 1/2):

```bash
# bash/zsh examples (type silently)
read -rs -p "Tunnel 1 PSK: " PSK1; echo
read -rs -p "Tunnel 2 PSK: " PSK2; echo
```

6. **Deploy the stack**:

```bash
aws cloudformation deploy \
  --stack-name "$STACK" \
  --template-file ./ice-sim.yaml \
  --region "$REGION" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    VgwTunnel1OutsideIp="$TUN1" \
    VgwTunnel2OutsideIp="$TUN2" \
    Tunnel1Psk="$PSK1" \
    Tunnel2Psk="$PSK2" \
    IcePublicPrefix="203.0.113.0/24" \
    BackendPrivatePrefix="10.200.1.0/24" \
    BackendDemoPort=8080
```

7. **Grab outputs**:

```bash
aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?starts_with(OutputKey, 'Ice') || ends_with(OutputKey,'Id')]" --output table
```

Key outputs:

* **IceSimulatorEip** → use this as the **Customer Gateway IP** on the hub.
* **IcePublicPrefixSimulated** → add to your hub **VPNConnectionRoute** entries.

---

## Wire up the hub

On the **hub** side (VGW design with NAT-GW SNAT):

1. **Customer Gateway**: set **IP = IceSimulatorEip**.
2. **VPN connection**: to your **VGW**, **StaticRoutesOnly=true**, crypto per your policy.
3. **Routes**:

   * **Spoke VPC RTs**: `ICE prefixes → TGW`.
   * **Hub Private (TGW attach) RTs**: `0.0.0.0/0 → NAT GW`. (So outbound to ICE goes through **NAT GW** first.)
   * **Hub Public/NAT RT**: `ICE prefixes → VGW` (VGW propagation or static route).
   * **Hub Public/NAT RT**: `Spoke CIDR(s) → TGW` (use a Prefix List).
4. **VPN static routes** (on both tunnels): add **each ICE prefix** you want to test (start with `203.0.113.0/24`).

---

## Sanity checks (before VPN up)

1. **SSM into the sim**:

```bash
SSW_ID=$(aws ec2 describe-instances --region "$REGION" \
  --filters "Name=tag:Name,Values=ICE-Sim-strongSwan" "Name=instance-state-name,Values=running" \
  --query "Reservations[0].Instances[0].InstanceId" --output text)
aws ssm start-session --region "$REGION" --target "$SSW_ID"
```

2. **Backend reachable from sim**:

```bash
BE_ID=$(aws ec2 describe-instances --region "$REGION" \
  --filters "Name=tag:Name,Values=ICE-Sim-Backend" "Name=instance-state-name,Values=running" \
  --query "Reservations[0].Instances[0].InstanceId" --output text)
BE_IP=$(aws ec2 describe-instances --region "$REGION" --instance-ids "$BE_ID" \
  --query "Reservations[0].Instances[0].PrivateIpAddress" --output text)

curl -v "http://$BE_IP:8080/" | head
```

3. **Libreswan service & config**:

```bash
sudo systemctl status ipsec --no-pager
sudo ipsec status               # shows conns LOADED; SAs will be 0 until hub matches
sudo sed -n '1,200p' /etc/ipsec.conf
sudo sed -n '1,200p' /etc/ipsec.d/vgw.conf
sudo sed -n '1,80p' /etc/ipsec.secrets
```

```bash
sudo systemctl status cloud-final --no-pager
sudo journalctl -u cloud-final -n 200 --no-pager

# Cloud-init logs:
sudo tail -n +200 /var/log/cloud-init-output.log
sudo tail -n +200 /var/log/cloud-init.log
```

4. **NAT rules present**:

```bash
sudo iptables -t nat -S | egrep 'PREROUTING|POSTROUTING|NETMAP'
sudo iptables -S FORWARD | head
```

---

## Bring tunnels UP

When the **hub** Customer Gateway points to the **sim EIP**, and PSKs/crypto line up:

```bash
sudo systemctl restart ipsec
sudo ipsec status
sudo journalctl -u ipsec -n 120 --no-pager
```

You should see `INSTALLED, TUNNEL` SAs with byte counters growing when you send traffic.

---

## End-to-end test (from a spoke)

Pick the test “ICE public” IP that maps to your backend host (host octet preserved):

* Backend `10.200.1.10` ↔ ICE `203.0.113.10`
* Backend `10.200.1.73` ↔ ICE `203.0.113.73`

From a **spoke EC2** (which routes `ICE → TGW`):

```bash
ICE_IP=203.0.113.10
curl -v "http://$ICE_IP:8080/" | head
```

**Watch on the sim** (in SSM session):

```bash
sudo iptables -t nat -L -v | egrep 'NETMAP|Chain'
sudo tcpdump -n -i any "host $BE_IP and tcp port 8080" -c 5
```

**Expected:**

* `curl` returns the directory listing.
* NAT counters increase, `ipsec status` bytes increase.
* Backend sees client **source IP = your hub NAT-GW private IP** (proves SNAT-before-VPN).

---

## Debugging checklist

* **Tunnels don’t come up**

  * PSKs mismatch → fix `/etc/ipsec.secrets` to match hub tunnel 1/2 exactly.
  * Wrong right= IPs → use `aws ec2 describe-vpn-connections` to get the two **AWS outside** IPs for that **specific** VPN connection.
  * Cipher/DH mismatch → try:

    * `ike=aes256-sha2_256;ecp256` & `esp=aes256-sha2_256;ecp256` (DH19), **or**
    * `ike=aes256-sha2_256;modp2048` & `esp=aes256-sha2_256;modp2048` (DH14).
  * Logs: `sudo journalctl -u ipsec -n 200 --no-pager`.

* **`ipsec` says “Pluto not running”**

  * Start it: `sudo systemctl enable --now ipsec`.
  * If service fails to start, your config files are missing/empty → re-write `/etc/ipsec.conf`, `/etc/ipsec.d/vgw.conf`, `/etc/ipsec.secrets` and restart.

* **Traffic hangs**

  * Spoke RT has `ICE → TGW`.
  * Hub **private RTs** send **default → NAT-GW** (so SNAT happens).
  * Hub **public/NAT RT** sends **ICE → VGW**, and **Spokes → TGW** (via Prefix List).
  * Security Groups allow TCP `8080`.

* **NAT rules missing**

  * Re-add:

    ```bash
    ICE_PFX=203.0.113.0/24
    BE_PFX=10.200.1.0/24
    sudo modprobe xt_NETMAP || true
    sudo iptables -t nat -A PREROUTING -d $ICE_PFX -j NETMAP --to $BE_PFX
    sudo iptables -t nat -A POSTROUTING -s $BE_PFX -j NETMAP --to $ICE_PFX
    sudo iptables -A FORWARD -d $BE_PFX -j ACCEPT
    sudo iptables -A FORWARD -s $BE_PFX -j ACCEPT
    ```

* **Cloud-init (user-data) failed**

  * Inspect: `sudo journalctl -u cloud-final -n 200 --no-pager` and `/var/log/cloud-init-output.log`.
  * On AL2023, prefer **Libreswan** + `iptables` (not `strongswan` / `iptables-services`).

---

## Simulating both endpoints (Mahwah + Chicago)

* **Option A (simplest):** just do **one** connection (Mahwah) = two tunnels.
* **Option B (one sim EIP for both):** create two hub VPN connections to **the same** sim EIP; on the sim add **four** `conn` stanzas:

  * `right=<Mahwah T1/T2>` with **Mahwah PSKs**
  * `right=<Chicago T1/T2>` with **Chicago PSKs**
* **Option C (closest to reality):** deploy **two** sim stacks (two EIPs) and point Mahwah/Chicago to different sim peers.

Example secrets file for Option B:

```
<SIM_EIP> <MAH_T1> : PSK "..."
<SIM_EIP> <MAH_T2> : PSK "..."
<SIM_EIP> <CHI_T1> : PSK "..."
<SIM_EIP> <CHI_T2> : PSK "..."
```

---

## What to send to ICE in production

Per connection (Mahwah/Chicago):

* **AWS Outside IPs**: Tunnel 1 = `<IP>`, Tunnel 2 = `<IP>`
* **PSKs**: Tunnel 1 = `<psk>`, Tunnel 2 = `<psk>`
* **Proposals**: IKEv1 AES256/SHA256/**DH19** (P1 14400s), ESP AES256/SHA256/**PFS19** (P2 3600s), DPD 10s
* **Selectors**: `0.0.0.0/0 ↔ 0.0.0.0/0` (route-based), or constrain to `<NAT GW private /32(s)> ↔ <ICE prefixes>`
* **Routing**: Static (no BGP). You will see **source IP = our NAT-GW private /32** over the tunnel.

---

## Update / delete

* **Update** (template changes, keep params):

```bash
aws cloudformation deploy \
  --stack-name "$STACK" \
  --template-file ./ice-sim.yaml \
  --region "$REGION" \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset
```

* **Delete**:

```bash
aws cloudformation delete-stack --stack-name "$STACK" --region "$REGION"
aws cloudformation wait stack-delete-complete --stack-name "$STACK" --region "$REGION"
```

---

## Quick IP cheat-sheet

* **Customer Gateway IP (peer you give to AWS)** = **sim EIP** (from stack output).
* **AWS Outside IPs** = the two **public IPs AWS assigns** per **VPN connection**; use for `right=` and in `/etc/ipsec.secrets`.
* **ICE public service IPs** = prefixes you route over VPN (test with `203.0.113.0/24` here), DNAT↔SNAT to backend via NETMAP.

---

If you want a one-liner to render your exact `/etc/ipsec.d/vgw.conf` and `/etc/ipsec.secrets` from your **two** VPN connection IDs, shout and we’ll add a small helper script.
