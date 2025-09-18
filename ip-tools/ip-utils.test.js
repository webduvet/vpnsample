/* eslint-env mocha */
'use strict';

const assert = require('node:assert/strict');
const sinon = require('sinon');

// adjust the path to your module:
const {
  intToIp,
  ipToInt,
  isAwsReservedIp,
  inCidr,
  parseCidr,
  cidrOverlaps,
} = require('../../lib/utils/ip-utils');

afterEach(() => {
  // handy if you add any spies/stubs in future tests
  sinon.restore();
});

describe('ipToInt / intToIp', () => {
  it('round-trips common IPs', () => {
    const samples = [
      '0.0.0.0',
      '255.255.255.255',
      '127.0.0.1',
      '10.0.1.42',
      '172.16.0.5',
      '192.168.1.200',
    ];
    for (const ip of samples) {
      const n = ipToInt(ip);
      assert.equal(intToIp(n), ip);
    }
  });

  it('edge numeric values', () => {
    assert.equal(ipToInt('0.0.0.0'), 0);
    assert.equal(ipToInt('255.255.255.255'), 0xffffffff);
    assert.equal(intToIp(0), '0.0.0.0');
    assert.equal(intToIp(0xffffffff), '255.255.255.255');
  });
});

describe('parseCidr', () => {
  it('parses /24', () => {
    const c = parseCidr('10.0.1.0/24');
    assert.equal(c.prefix, 24);
    assert.equal(c.mask, 0xffffff00);
    assert.equal(c.base, ipToInt('10.0.1.0'));
    assert.equal(c.last, ipToInt('10.0.1.255'));
  });

  it('parses /0 (whole space)', () => {
    const c = parseCidr('0.0.0.0/0');
    assert.equal(c.prefix, 0);
    assert.equal(c.mask, 0);
    assert.equal(c.base, 0);
    assert.equal(c.last, 0xffffffff);
  });

  it('throws on invalid CIDR syntax', () => {
    assert.throws(() => parseCidr('10.0.0.0'), /Invalid CIDR/i);
  });

  it('throws on prefix out of range', () => {
    assert.throws(() => parseCidr('10.0.0.0/33'), /out of range/i);
    assert.throws(() => parseCidr('10.0.0.0/'), /out of range/i);
  });

  it('NOTE: current impl does not validate dotted-quad; x.y.z.w collapses to 0', () => {
    const c = parseCidr('x.y.z.w/24');
    assert.equal(c.base, 0);
    assert.equal(c.last, 255);
  });
});

describe('inCidr', () => {
  it('inside /24 boundaries', () => {
    const cidr = '10.0.1.0/24';
    assert.equal(inCidr('10.0.1.0', cidr), true);     // base
    assert.equal(inCidr('10.0.1.42', cidr), true);    // middle
    assert.equal(inCidr('10.0.1.255', cidr), true);   // last
  });

  it('outside /24', () => {
    const cidr = '10.0.1.0/24';
    assert.equal(inCidr('10.0.0.255', cidr), false);
    assert.equal(inCidr('10.0.2.0', cidr), false);
  });

  it('/32 contains only itself', () => {
    const cidr = '203.0.113.5/32';
    assert.equal(inCidr('203.0.113.5', cidr), true);
    assert.equal(inCidr('203.0.113.4', cidr), false);
    assert.equal(inCidr('203.0.113.6', cidr), false);
  });
});

describe('isAwsReservedIp', () => {
  // AWS reserves first 4 + last in every subnet
  it('reserved in /24', () => {
    const cidr = '192.168.10.0/24';
    assert.equal(isAwsReservedIp('192.168.10.0', cidr), true);   // base
    assert.equal(isAwsReservedIp('192.168.10.1', cidr), true);
    assert.equal(isAwsReservedIp('192.168.10.2', cidr), true);
    assert.equal(isAwsReservedIp('192.168.10.3', cidr), true);
    assert.equal(isAwsReservedIp('192.168.10.255', cidr), true); // last
  });

  it('non-reserved in /24', () => {
    const cidr = '192.168.10.0/24';
    assert.equal(isAwsReservedIp('192.168.10.4', cidr), false);
    assert.equal(isAwsReservedIp('192.168.10.5', cidr), false);
    assert.equal(isAwsReservedIp('192.168.10.254', cidr), false);
  });

  it('reserved in /28', () => {
    const cidr = '192.168.1.16/28'; // .16 .. .31
    assert.equal(isAwsReservedIp('192.168.1.16', cidr), true); // base
    assert.equal(isAwsReservedIp('192.168.1.17', cidr), true);
    assert.equal(isAwsReservedIp('192.168.1.18', cidr), true);
    assert.equal(isAwsReservedIp('192.168.1.19', cidr), true);
    assert.equal(isAwsReservedIp('192.168.1.31', cidr), true); // last
    assert.equal(isAwsReservedIp('192.168.1.20', cidr), false);
  });

  it('IP outside CIDR is not reserved', () => {
    const cidr = '10.0.0.0/24';
    assert.equal(isAwsReservedIp('10.0.1.0', cidr), false);
  });
});

describe('cidrOverlaps', () => {
  it('identical ranges overlap', () => {
    assert.equal(cidrOverlaps('10.0.0.0/24', '10.0.0.0/24'), true);
  });

  it('subset/superset overlap', () => {
    assert.equal(cidrOverlaps('10.0.0.0/16', '10.0.1.0/24'), true);
  });

  it('neighbors do not overlap', () => {
    assert.equal(cidrOverlaps('10.0.0.0/24', '10.0.1.0/24'), false);
    assert.equal(cidrOverlaps('10.0.0.0/25', '10.0.0.128/25'), false);
  });

  it('disjoint does not overlap', () => {
    assert.equal(cidrOverlaps('192.168.0.0/24', '192.168.2.0/24'), false);
  });
});
