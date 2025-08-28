
const params = {
	"iceCidrs": ["158.224.40.0/24","158.224.24.0/24","158.224.8.0/24"],
	"natGateways": 2,
	"spokePrefixListId": "pl-0123456789abcdef0",
	"iceMahwahIp": "203.0.113.10",
	"iceChicagoIp": "203.0.113.20",
	"pskMahwahT1": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:vpn/ice-mahwa-tunnel-1-psk",
	"pskMahwahT2": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:vpn/ice-mahwa-tunnel-2-psk",
	"pskChicagoT1": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:vpn/ice-chicago-tunnel-1-psk",
	"pskChicagoT2": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:vpn/ice-chicago-tunnel-2-psk",
	"VpnTunnel1PreSharedKeySecret":"arn:aws:secretsmanager:eu-west-1:652907189137:secret:vpn/ice-mahwa-tunnel-1-psk-m0cjdD",
	"VpnTunnel2PreSharedKeySecret":"arn:aws:secretsmanager:eu-west-1:652907189137:secret:vpn/ice-mahwa-tunnel-2-psk-U1rTwl",
	"VpnTunnel3PreSharedKeySecret":"arn:aws:secretsmanager:eu-west-1:652907189137:secret:vpn/ice-chicago-tunnel-1-psk-9mbGYX",
	"VpnTunnel4PreSharedKeySecret":"arn:aws:secretsmanager:eu-west-1:652907189137:secret:vpn/ice-chicago-tunnel-2-psk-QZVI6n"
}
module.exports = function param(name) {
	return params[name];
}
