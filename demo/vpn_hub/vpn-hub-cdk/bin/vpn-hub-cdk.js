#!/usr/bin/env node
const cdk = require('aws-cdk-lib');
const { VpnHubStack } = require('../lib/vpn-hub-stack');
const params = require('../env.dev');

const app = new cdk.App();

// Read config from context (cdk.json) or env
const iceCidrs = app.node.tryGetContext('iceCidrs') || ['158.224.40.0/24'];

new VpnHubStack(app, 'VpnHubStack', {
	env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
	iceCidrs,
	natGateways: Number(params('natGateways') ?? 2), // set 1 for single Servisbot IP
	tgwId: params('tgwId'),
	spokePrefixListId: params('spokePrefixListId'),
	iceMahwahIp: params('iceMahwahIp'),
	iceChicagoIp: params('iceChicagoIp'),
	pskSecrets: {
		mahwahT1: params('pskMahwahT1'),
		mahwahT2: params('pskMahwahT2'),
		chicagoT1: params('pskChicagoT1'),
		chicagoT2: params('pskChicagoT2'),
	},
});
