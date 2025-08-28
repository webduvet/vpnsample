aws cloudformation deploy \
--template-file hub.yaml \
--stack-name vpn-hub \
--capabilities CAPABILITY_NAMED_IAM \
--region eu-west-1 \
--parameter-overrides \
  KeyName=my-test-key \
  ICECustomerGatewayIpMahwah=159.125.79.130 \
  ICECustomerGatewayIpChicago=162.68.209.130 \
  ICENetworkCidrs=158.224.40.0/24 \
  VpnTunnel1PreSharedKeySecret="arn:aws:secretsmanager:eu-west-1:652907189137:secret:vpn/ice-mahwa-tunnel-1-psk-m0cjdD" \
  VpnTunnel2PreSharedKeySecret="arn:aws:secretsmanager:eu-west-1:652907189137:secret:vpn/ice-mahwa-tunnel-2-psk-U1rTwl" \
  VpnTunnel3PreSharedKeySecret="arn:aws:secretsmanager:eu-west-1:652907189137:secret:vpn/ice-chicago-tunnel-1-psk-9mbGYX" \
  VpnTunnel4PreSharedKeySecret="arn:aws:secretsmanager:eu-west-1:652907189137:secret:vpn/ice-chicago-tunnel-2-psk-QZVI6n"
