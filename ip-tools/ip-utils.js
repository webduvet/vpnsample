/* eslint-disable no-bitwise */

function ipToInt(ip) {
  return ip.split('.').map(Number).reduce((a, o) => (a << 8) + o, 0) >>> 0;
}

function intToIp(n) {
  return [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
}

function parseCidr(c) {
  const [ip, p] = c.split('/');
  if (!ip || p === undefined) throw new TypeError(`Invalid CIDR: ${c}`);
  const prefix = Number.parseInt(p, 10);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new TypeError(`CIDR prefix out of range: ${p}`);
  }

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const base = ((ipToInt(ip) & mask) >>> 0);
  const last = (base | (~mask >>> 0)) >>> 0;

  return { base, last, mask, prefix };
}

function inCidr(ip, cidr) {
  const n = ipToInt(ip);
  const { base, last } = parseCidr(cidr);
  return n >= base && n <= last;
}

function isAwsReservedIp(ip, cidr) {
  const n = ipToInt(ip);
  const { base, last } = parseCidr(cidr);

  if (n < base || n > last) return false;

  const offset = n - base;
  // AWS reserves first 4 and last 1 address in every subnet
  const reservedOffsets = new Set([0, 1, 2, 3, last - base]);
  return reservedOffsets.has(offset);
}

function cidrOverlaps(a, b) {
  const A = parseCidr(a);
  const B = parseCidr(b);
  return A.base <= B.last && B.base <= A.last;
}

module.exports = {
  intToIp,
  ipToInt,
  isAwsReservedIp,
  inCidr,
  parseCidr,
  cidrOverlaps,
};
