
# Find VPN attachment IDs from VPN connection IDs
VPN_CONN_MAHWAH=<vpn-xxxxxxxxxxxxxxxxx>
VPN_CONN_CHICAGO=<vpn-yyyyyyyyyyyyyyyyy>

VPN_ATT_MAHWAH=$(aws ec2 describe-transit-gateway-attachments \
  --filters Name=resource-id,Values=$VPN_CONN_MAHWAH \
  --query "TransitGatewayAttachments[0].TransitGatewayAttachmentId" --output text)

VPN_ATT_CHICAGO=$(aws ec2 describe-transit-gateway-attachments \
  --filters Name=resource-id,Values=$VPN_CONN_CHICAGO \
  --query "TransitGatewayAttachments[0].TransitGatewayAttachmentId" --output text)

# Associate both VPN attachments to RTFromVpn (ingress from ICE)
aws ec2 associate-transit-gateway-route-table \
  --transit-gateway-route-table-id <RTFromVpnId> \
  --transit-gateway-attachment-id "$VPN_ATT_MAHWAH"

aws ec2 associate-transit-gateway-route-table \
  --transit-gateway-route-table-id <RTFromVpnId> \
  --transit-gateway-attachment-id "$VPN_ATT_CHICAGO"

# OPTIONAL: If you didn’t pass VpnAttachmentIdPrimary as a parameter,
# create the egress route dynamically here instead of in CFN:
aws ec2 create-transit-gateway-route \
  --transit-gateway-route-table-id <RTFromEgressId> \
  --destination-cidr-block <ICE_CIDR> \
  --transit-gateway-attachment-id "$VPN_ATT_MAHWAH"
