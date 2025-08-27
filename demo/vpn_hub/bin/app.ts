import * as cdk from 'aws-cdk-lib';
import { VpnHubStack } from '../lib/vpn-hub-stack';

const app = new cdk.App();

// Provide ICE prefixes here (or use context/env to load)
const iceCidrs = [
	'158.224.40.0/24',
	// ... add all ~40
];

new VpnHubStack(app, 'VpnHubStack', {
	env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
	iceCidrs,
	natGateways: 2,                          // set to 1 if you want a single Servisbot egress IP
	tgwId: undefined,                        // set to an existing TGW id to reuse
	spokePrefixListId: 'pl-xxxxxxxx',        // managed prefix list of all spoke CIDRs (optional but recommended)
	iceMahwahIp: 'x.x.x.x',
	iceChicagoIp: 'y.y.y.y',
	pskSecrets: {
		mahwahT1: 'arn:aws:secretsmanager:...:secret:psk-mahwah-1-xxxxx',
		mahwahT2: 'arn:aws:secretsmanager:...:secret:psk-mahwah-2-xxxxx',
		chicagoT1: 'arn:aws:secretsmanager:...:secret:psk-chicago-1-xxxxx',
		chicagoT2: 'arn:aws:secretsmanager:...:secret:psk-chicago-2-xxxxx',
	},
});
