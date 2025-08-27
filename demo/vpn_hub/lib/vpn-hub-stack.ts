import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface VpnHubProps extends cdk.StackProps {
	iceCidrs: string[];                         // ~40 prefixes
	natGateways?: number;                       // 1 (single egress IP) or 2 (HA)
	tgwId?: string;                             // reuse existing TGW if provided
	spokePrefixListId?: string;                 // managed PL for spoke CIDRs (optional)
	iceMahwahIp: string;
	iceChicagoIp: string;
	pskSecrets: {
		mahwahT1: string; mahwahT2: string;
		chicagoT1: string; chicagoT2: string;
	};
}

export class VpnHubStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props: VpnHubProps) {
		super(scope, id, props);

		// 1) Hub VPC (2 AZs), NAT GWs
		const vpc = new ec2.Vpc(this, 'HubVpc', {
			ipAddresses: ec2.IpAddresses.cidr('10.100.0.0/16'),
			maxAzs: 2,
			natGateways: props.natGateways ?? 2,
			subnetConfiguration: [
				{ name: 'Public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
				{ name: 'Private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
			],
		});

		// 2) Optional: existing TGW or create one
		const tgw = props.tgwId
			? ec2.CfnTransitGateway.fromTransitGatewayId(this, 'ExistingTgw', props.tgwId)
			: new ec2.CfnTransitGateway(this, 'Tgw', {
				description: 'Central TGW for spokes',
				defaultRouteTableAssociation: 'disable',
				defaultRouteTablePropagation: 'disable',
			});

		const tgwId = props.tgwId ?? (tgw as ec2.CfnTransitGateway).ref;

		const tgwRtb = new ec2.CfnTransitGatewayRouteTable(this, 'TgwFromSpokes', {
			transitGatewayId: tgwId,
		});

		const hubAttach = new ec2.CfnTransitGatewayVpcAttachment(this, 'TgwAttachHubVpc', {
			transitGatewayId: tgwId,
			vpcId: vpc.vpcId,
			subnetIds: vpc.selectSubnets({ subnetGroupName: 'Private' }).subnetIds,
		});

		// (We export the RTB for spokes to associate; spokes add their own ICE→TGW routes.)

		// 3) VGW + attach to VPC
		const vgw = new ec2.CfnVPNGateway(this, 'Vgw', { type: 'ipsec.1' });
		new ec2.CfnVPCGatewayAttachment(this, 'AttachVgw', {
			vpcId: vpc.vpcId,
			vpnGatewayId: vgw.ref,
		});

		// 4) Customer Gateways
		const cgwMah = new ec2.CfnCustomerGateway(this, 'CgwMahwah', {
			ipAddress: props.iceMahwahIp,
			type: 'ipsec.1',
			bgpAsn: 65000,
		});
		const cgwChi = new ec2.CfnCustomerGateway(this, 'CgwChicago', {
			ipAddress: props.iceChicagoIp,
			type: 'ipsec.1',
			bgpAsn: 65001,
		});

		// 5) VPN connections (VGW-terminated), IKE/ESP pinned to ICE sheet
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

		// 6) Add VPN static routes for ALL ICE CIDRs (CDK loops keep it tiny)
		props.iceCidrs.forEach((cidr, i) => {
			new ec2.CfnVPNConnectionRoute(this, `MahRoute${i}`, {
				vpnConnectionId: vpnMah.ref,
				destinationCidrBlock: cidr,
			});
			new ec2.CfnVPNConnectionRoute(this, `ChiRoute${i}`, {
				vpnConnectionId: vpnChi.ref,
				destinationCidrBlock: cidr,
			});
			// Optional: add TGW routes for spokes here too, or let spokes add them in their own stacks.
			// new ec2.CfnTransitGatewayRoute(this, `TgwIce${i}`, {
			//   transitGatewayRouteTableId: tgwRtb.ref,
			//   destinationCidrBlock: cidr,
			//   transitGatewayAttachmentId: hubAttach.ref,
			// });
		});

		// 7) NAT-subnet route tables: propagate ICE routes from VGW (no per-CIDR entries to manage)
		// CDK Vpc creates one RTB per public subnet; propagate to both.
		const publicRtIds = vpc.publicSubnets.map(s => s.routeTable.routeTableId);
		new ec2.CfnVPNGatewayRoutePropagation(this, 'VgwPropagateToPublicRtbs', {
			vpnGatewayId: vgw.ref,
			routeTableIds: publicRtIds,
		});

		// 8) Public RTBs: ensure replies after de-NAT go back to TGW (via spoke prefix list)
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
		new cdk.CfnOutput(this, 'TgwFromSpokesRtbId', { value: tgwRtb.ref, description: 'Associate spoke attachments to this RTB' });
		new cdk.CfnOutput(this, 'TgwHubAttachmentId', { value: hubAttach.ref });
		new cdk.CfnOutput(this, 'VgwId', { value: vgw.ref });
		new cdk.CfnOutput(this, 'VpnMahwahId', { value: vpnMah.ref });
		new cdk.CfnOutput(this, 'VpnChicagoId', { value: vpnChi.ref });
	}
}
