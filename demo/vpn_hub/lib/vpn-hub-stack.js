const cdk = require('aws-cdk-lib');
const ec2 = require('aws-cdk-lib/aws-ec2');
const { Construct } = require('constructs');

class VpnHubStack extends cdk.Stack {
	/**
	 * props: {
	 *   iceCidrs: string[], natGateways?: number, tgwId?: string, spokePrefixListId?: string,
	 *   iceMahwahIp: string, iceChicagoIp: string, pskSecrets: {mahwahT1,mahwahT2,chicagoT1,chicagoT2}
	 * }
	 */
	constructor(scope, id, props) {
		super(scope, id, props);

		// 1) Hub VPC (2 AZs) with NAT GWs (1 or 2)
		const vpc = new ec2.Vpc(this, 'HubVpc', {
			ipAddresses: ec2.IpAddresses.cidr('10.100.0.0/16'),
			maxAzs: 2,
			natGateways: props.natGateways ?? 2,
			subnetConfiguration: [
				{ name: 'Public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
				{ name: 'Private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
			],
		});

		// 2) TGW (reuse or create) and a route table “from spokes”
		const tgw = props.tgwId
			? ec2.CfnTransitGateway.fromTransitGatewayId(this, 'ExistingTgw', props.tgwId)
			: new ec2.CfnTransitGateway(this, 'Tgw', {
				description: 'Central TGW for spokes',
				defaultRouteTableAssociation: 'disable',
				defaultRouteTablePropagation: 'disable',
			});
		const tgwId = props.tgwId ?? tgw.ref;

		const tgwRtb = new ec2.CfnTransitGatewayRouteTable(this, 'TgwFromSpokes', {
			transitGatewayId: tgwId,
		});

		const hubAttach = new ec2.CfnTransitGatewayVpcAttachment(this, 'TgwAttachHubVpc', {
			transitGatewayId: tgwId,
			vpcId: vpc.vpcId,
			subnetIds: vpc.selectSubnets({ subnetGroupName: 'Private' }).subnetIds,
		});

		// (Spokes associate to tgwRtb in their own stacks; they add ICE → TGW routes.)

		// 3) VGW + attach to VPC
		const vgw = new ec2.CfnVPNGateway(this, 'Vgw', { type: 'ipsec.1' });
		new ec2.CfnVPCGatewayAttachment(this, 'AttachVgw', {
			vpcId: vpc.vpcId,
			vpnGatewayId: vgw.ref,
		});

		// 4) Customer gateways (ICE)
		const cgwMah = new ec2.CfnCustomerGateway(this, 'CgwMahwah', {
			ipAddress: props.iceMahwahIp, type: 'ipsec.1', bgpAsn: 65000,
		});
		const cgwChi = new ec2.CfnCustomerGateway(this, 'CgwChicago', {
			ipAddress: props.iceChicagoIp, type: 'ipsec.1', bgpAsn: 65001,
		});

		// 5) VPN connections (VGW-terminated), crypto pinned to ICE sheet
		const ike = {
			ikeVersions: ['ikev1'],
			phase1EncryptionAlgorithms: ['AES256'],
			phase1IntegrityAlgorithms: ['SHA2-256'],
			phase1DhGroupNumbers: [19],
			phase1LifetimeSeconds: 14400,
			phase2EncryptionAlgorithms: ['AES256'],
			phase2IntegrityAlgorithms: ['SHA2-256'],
			phase2DhGroupNumbers: [19],
			phase2LifetimeSeconds: 3600,
			dpdTimeoutSeconds: 30,
		};
		const vpnMah = new ec2.CfnVPNConnection(this, 'VpnMahwah', {
			type: 'ipsec.1',
			vpnGatewayId: vgw.ref,
			customerGatewayId: cgwMah.ref,
			staticRoutesOnly: true,
			vpnTunnelOptionsSpecifications: [
				{ preSharedKey: `{{resolve:secretsmanager:${props.pskSecrets.mahwahT1}}}`, ...ike },
				{ preSharedKey: `{{resolve:secretsmanager:${props.pskSecrets.mahwahT2}}}`, ...ike },
			],
		});
		const vpnChi = new ec2.CfnVPNConnection(this, 'VpnChicago', {
			type: 'ipsec.1',
			vpnGatewayId: vgw.ref,
			customerGatewayId: cgwChi.ref,
			staticRoutesOnly: true,
			vpnTunnelOptionsSpecifications: [
				{ preSharedKey: `{{resolve:secretsmanager:${props.pskSecrets.chicagoT1}}}`, ...ike },
				{ preSharedKey: `{{resolve:secretsmanager:${props.pskSecrets.chicagoT2}}}`, ...ike },
			],
		});

		// 6) Add VPN static routes for ALL ICE CIDRs
		props.iceCidrs.forEach((cidr, i) => {
			new ec2.CfnVPNConnectionRoute(this, `MahRoute${i}`, {
				vpnConnectionId: vpnMah.ref,
				destinationCidrBlock: cidr,
			});
			new ec2.CfnVPNConnectionRoute(this, `ChiRoute${i}`, {
				vpnConnectionId: vpnChi.ref,
				destinationCidrBlock: cidr,
			});
			// Optional: spokes can also add per-prefix TGW routes pointing to hubAttach
			// new ec2.CfnTransitGatewayRoute(this, `TgwIce${i}`, {
			//   transitGatewayRouteTableId: tgwRtb.ref,
			//   destinationCidrBlock: cidr,
			//   transitGatewayAttachmentId: hubAttach.ref,
			// });
		});

		// 7) Propagate ICE routes from VGW into NAT-subnet route tables (public RTBs)
		const publicRtIds = vpc.publicSubnets.map(s => s.routeTable.routeTableId);
		new ec2.CfnVPNGatewayRoutePropagation(this, 'VgwPropagateToPublicRtbs', {
			vpnGatewayId: vgw.ref,
			routeTableIds: publicRtIds,
		});

		// 8) Ensure replies after de-NAT go back to TGW (via spoke prefix list)
		if (props.spokePrefixListId) {
			publicRtIds.forEach((rtId, idx) => {
				new ec2.CfnRoute(this, `PublicRtbSpokesToTgw${idx}`, {
					routeTableId: rtId,
					destinationPrefixListId: props.spokePrefixListId,
					transitGatewayId: tgwId,
				});
			});
		}

		// Outputs
		new cdk.CfnOutput(this, 'VpcId', { value: vpc.vpcId });
		new cdk.CfnOutput(this, 'TgwId', { value: tgwId });
		new cdk.CfnOutput(this, 'TgwFromSpokesRtbId', { value: tgwRtb.ref });
		new cdk.CfnOutput(this, 'TgwHubAttachmentId', { value: hubAttach.ref });
		new cdk.CfnOutput(this, 'VgwId', { value: vgw.ref });
		new cdk.CfnOutput(this, 'VpnMahwahId', { value: vpnMah.ref });
		new cdk.CfnOutput(this, 'VpnChicagoId', { value: vpnChi.ref });
	}
}

module.exports = { VpnHubStack };
