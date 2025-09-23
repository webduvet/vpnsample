
Perfect—Option A with multiple hostnames is straightforward. Here’s a clean, copy-pasteable setup.

# 1) VpnSim: Private DNS server (CoreDNS) with your mappings

Spin up a small EC2 in **VpnSim** (same “on-prem” side the VPN reaches). Give it a **static private IP** (example: `10.200.1.53`). Open **UDP/TCP 53** in its Security Group (source = the **VpnHub** VPC CIDRs).

## CoreDNS config (Docker)

**/etc/coredns/Corefile**

```txt
. {
  # refuse anything we don't explicitly serve (keeps it tidy)
  refuse
}

1234ice.com {
  file /etc/coredns/1234ice.db
  log
  errors
  cache 30
}
```

**/etc/coredns/1234ice.db**

```txt
$ORIGIN 1234ice.com.
$TTL 60
@          IN SOA ns1.1234ice.com. hostmaster.1234ice.com. (1 60 30 120 60)
           IN NS  ns1.1234ice.com.
ns1        IN A   10.200.1.53

; Your test services -> ICE/Blacknight-like public IPs in TEST-NET-3
service1   IN A   203.0.113.246
service2   IN A   203.0.113.247

; (Optionally add more)
;api       IN A   203.0.113.248
;auth      IN A   203.0.113.249
```

Run CoreDNS:

```bash
sudo docker run -d --name coredns --network host \
  -v /etc/coredns/Corefile:/Corefile:ro \
  -v /etc/coredns/1234ice.db:/1234ice.db:ro \
  coredns/coredns:latest -conf /Corefile
```

### Network allowances you must have

* **Security Group on CoreDNS EC2:** allow **UDP 53** and **TCP 53** from **VpnHub** private subnets’ CIDRs.
* **Libreswan / instance firewall (iptables/nftables):** allow UDP/TCP 53 to/from VpnHub over the tunnel.
* **Routes:** ensure VpnHub subnets can reach `10.200.1.53` via the VPN.

---

# 2) VpnHub: Route 53 Resolver outbound + conditional forward rule

You need an **Outbound Endpoint** in **two private subnets** of **VpnHub** (different AZs), and a **Resolver rule** that forwards `1234ice.com` queries to `10.200.1.53`.

> Replace placeholders like `VpcId`, `SubnetIdA/B`, etc.

## (a) Security group for the outbound endpoint ENIs

```bash
aws ec2 create-security-group \
  --group-name r53-outbound-dns \
  --description "Route53 Resolver outbound ENIs" \
  --vpc-id VPC-XXXXXXXX \
  --tag-specifications 'ResourceType=security-group,Tags=[{Key=Name,Value=VpnHub-r53-outbound}]'
```

Allow outbound DNS (usually allowed by default egress “all”), and **you don’t need inbound rules** on this SG; the ENIs *initiate* to your DNS server. Make sure your **CoreDNS EC2 SG** allows inbound from the VpnHub CIDRs.

## (b) Create the outbound endpoint

```bash
aws route53resolver create-outbound-endpoint \
  --name VpnHub-outbound-dns \
  --creator-request-id $(uuidgen) \
  --security-group-ids sg-OUTBOUND_DNS_SG \
  --ip-addresses SubnetId=subnet-PRIV_A,Ip=10.0.1.10 SubnetId=subnet-PRIV_B,Ip=10.0.2.10
```

* You can omit the `Ip=` parts to let AWS auto-assign from those subnets.
* Capture the returned `ResolverEndpoint.Id` (call it `rslvr-ept-xxxx`).

## (c) Create the conditional forward rule

```bash
aws route53resolver create-resolver-rule \
  --creator-request-id $(uuidgen) \
  --name forward-1234ice \
  --rule-type FORWARD \
  --domain-name 1234ice.com \
  --resolver-endpoint-id rslvr-ept-xxxx \
  --target-ips Ip=10.200.1.53,Port=53
```

Capture `ResolverRule.Id` (call it `rslvr-rl-xxxx`).

## (d) Associate the rule to the VpnHub VPC

```bash
aws route53resolver associate-resolver-rule \
  --resolver-rule-id rslvr-rl-xxxx \
  --vpc-id VPC-XXXXXXXX \
  --name use-1234ice
```

That’s it—**all instances & Lambdas in VpnHub** now resolve `*.1234ice.com` via your CoreDNS over the VPN.

---

# 3) Test DNS from VpnHub

From a test EC2 in the same subnets as your Lambda ENIs (or just any instance in VpnHub):

```bash
getent hosts service1.1234ice.com
# expect: 203.0.113.246

getent hosts service2.1234ice.com
# expect: 203.0.113.247

# If you have dig:
dig +short service1.1234ice.com
dig +short service2.1234ice.com
```

If those return the expected IPs, Lambda will resolve identically (Node defers to libc → VPC .2 → R53 Resolver).

---

# 4) Wire it into your Lambda forwarder

Now your request body can use FQDNs:

```json
{
  "endpoint": "https://service1.1234ice.com:8080",
  "agentOptions": {
    "keepAlive": true,
    "maxSockets": 10
  }
}
```

### TLS/SNI/Host header

* If you run **HTTP** on 8080 for now, just point to `http://...:8080`.
* If you run **HTTPS** and your test certificate **doesn’t** match `service1.1234ice.com`, either:

  * inject your **test CA** into the Lambda agent (`https.Agent({ ca })`), or
  * temporarily set `rejectUnauthorized: false` (lab only).
* Ensure your forwarder sets **SNI** and **Host** to the FQDN:

  * `servername: 'service1.1234ice.com'`
  * `Host: service1.1234ice.com`

---

# 5) Traffic & routes (don’t forget)

* **VpnHub → VpnSim**: routes for `203.0.113.0/24` and/or `10.200.1.0/24` over the VPN (depending what your A records point to).
* **Security Groups/NACLs**:

  * allow **TCP 8080 (or 443)** *from VpnHub subnets* to your backend EC2.
  * allow **UDP/TCP 53** *from VpnHub subnets* to your CoreDNS EC2.
* **MTU**: If you see weird timeouts, check PMTUD or set MTU a bit lower on libreswan interface.

---

## Variants & extras (optional)

* Add more names by editing `1234ice.db`:

  ```txt
  api      IN A 203.0.113.248
  files    IN A 203.0.113.249
  ```
* Use **private IPs** instead (e.g., `10.200.1.246/247`) to test *fully private* addressing.
* Add a **wildcard** (for broad testing):

  ```txt
  *.dev    IN A 203.0.113.246
  ```

---

If you want, I can convert the AWS CLI above into **CDK** (TypeScript) constructs for the **Outbound Endpoint**, **Resolver rule**, and **association**, plus a **systemd** service file for CoreDNS (non-Docker).
