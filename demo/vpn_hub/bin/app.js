#!/usr/bin/env node
const cdk = require('aws-cdk-lib');
const { VpnHubStack } = require('../lib/vpn-hub-stack');

const app = new cdk.App();

// Read config from context (cdk.json) or env
const iceCidrs = app.node.tryGetContext('iceCidrs') || ['158.224.40.0/24'];

new VpnHubStack(app, 'VpnHubStack', {
	env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
	iceCidrs,
	natGateways: Number(app.node.tryGetContext('natGateways') ?? 2), // set 1 for single Servisbot IP
	tgwId: app.node.tryGetContext('tgwId'),
	spokePrefixListId: app.node.tryGetContext('spokePrefixListId'),
	iceMahwahIp: app.node.tryGetContext('iceMahwahIp'),
	iceChicagoIp: app.node.tryGetContext('iceChicagoIp'),
	pskSecrets: {
		mahwahT1: app.node.tryGetContext('pskMahwahT1'),
		mahwahT2: app.node.tryGetContext('pskMahwahT2'),
		chicagoT1: app.node.tryGetContext('pskChicagoT1'),
		chicagoT2: app.node.tryGetContext('pskChicagoT2'),
	},
});
