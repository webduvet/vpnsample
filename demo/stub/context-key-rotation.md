

## Solution description (stack description)


The Vpn stack consist of:
Separate AWS Account for the VpnHub (centralized services)

One VPC (VpnHub) with:
- 2 Private Subnets in different AZs (for high availability)
- VPC CIDR:
    - 10.100.0.0/16
    - Private Subnet A:
        -10.100.0.0/24
    - Private Subnet B:
        -10.100.1.0/24
    - NAT Gateway in each AZ (for outbound internet access for instances in private subnets)
        - 10.100.2.0/28
        - 10.100.2.16/28
- VGW attached Site to Site VPN connection
- TGW attachment

- Lambda attached to private subnets which is doing the forward request to ICE endpoints over VPN.

- Api Gateway
  - Public endpoint secured with API (v1).
  - invoking Lambda in private subnet.


## Service we access via VPN
This is ICE/Blackknight mortgage services. (IMT)
Ice gave us pool of CIDRs which we need to route via VPN.
(we do wait for the exactl FQDNs we need to access, or if we will access APIs via IPs)

They expect Ipsec VPN connection from our side.(tunnels are built according to their specs, IKEv2, AES256, SHA256, DH Group19 , phase1 14400, phase2 3600, PSK)

## Communication with ICE/Blackknight

- We need to fill and deliver the ICE customer build sheet
- We share preshared key via (secure communication channel)



## Rekey rotation process

rotation time frame TBC 

Our process:
Our keys are stored in AWS Secrets Manager

The following secrets are created in AWS Secrets Manager:

- vpn/prod/ice-mahwah-t1-psk
- vpn/prod/ice-mahwah-t2-psk
- vpn/prod/ice-chicago-t1-psw
- vpn/prod/ice-chicago-t2-psk


To create new Version of the secret is done via AWS CLI or Console - it is manual process. Since we need to share the new PSK with ICE/Blackknight via secure channel.
In Aws console

Go to Secrets Manager -> select the secret
    click on Actions -> Edit encryption key
    check "Create new version of secret with new encryption key." and confirm

repeat for all 4 secrets

After new version of the secret is created, we need to update the VPN connection with new PSK.

In platform manager look at the productino config file and search for this section:
```
  "PresharedKeyMahwahT1": {
    "arn": "arn:aws:secretsmanager:us-east-1:295849061873:secret:vpn/prod/ice-mahwah-t1-psk-vHDsKU",
    "versionId": "607867bc-16a5-45af-b516-ca1f3707dcd6"
  },
  "PresharedKeyMahwahT2": {
    "arn": "arn:aws:secretsmanager:us-east-1:295849061873:secret:vpn/prod/ice-mahwah-t2-psk-6fdGFi",
    "versionId": "1f121e3f-3f40-46c1-a9a8-65e07626748f"
  },
  "PresharedKeyChicagoT1": {
    "arn": "arn:aws:secretsmanager:us-east-1:295849061873:secret:vpn/prod/ice-chicago-t1-psk-NM3c7D",
    "versionId": "ea377081-ccd9-4b05-a63e-05bb7f0e08cd"
  },
  "PresharedKeyChicagoT2": {
    "arn": "arn:aws:secretsmanager:us-east-1:295849061873:secret:vpn/prod/ice-chicago-t2-psk-vXIUYa",
    "versionId": "4adb5c77-5b84-4b57-bca3-7943f175d75c"
  }
```
Replace the versionId with the new versionId of the secret you just created in Secrets Manager.
Then redeploy the platform manager stack to apply the changes.


Vpn connections will be updated with new PSK and the tunnels will be rekeyed.
TBC - rekey process to be confirmed with ICE/Blackknight

