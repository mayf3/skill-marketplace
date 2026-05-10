import { Request, Response, NextFunction } from 'express';

/** RFC 1918 + 本地回环 */
const ALLOWED_RANGES = [
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
];

function isIpInCidr(ip: string, cidr: string): boolean {
  const [baseIp, maskBitsStr] = cidr.split('/');
  if (!maskBitsStr) return ip === cidr;

  const maskBits = parseInt(maskBitsStr, 10);
  const ipParts = ip.split('.').map(Number);
  const baseParts = baseIp.split('.').map(Number);

  if (ipParts.length !== 4 || baseParts.length !== 4) return false;

  const ipNum = ((ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3]) >>> 0;
  const baseNum = ((baseParts[0] << 24) | (baseParts[1] << 16) | (baseParts[2] << 8) | baseParts[3]) >>> 0;
  const mask = maskBits === 0 ? 0 : ((~0 << (32 - maskBits)) >>> 0);

  return (ipNum & mask) === (baseNum & mask);
}

export function ipWhitelist(req: Request, res: Response, next: NextFunction): void {
  const forwarded = req.headers['x-forwarded-for'] as string | undefined;
  const rawIp = forwarded?.split(',')[0].trim() || req.ip || req.socket.remoteAddress || '';
  const clientIp = rawIp.replace(/^::ffff:/, '');

  if (clientIp === '::1') return next();

  const isAllowed = ALLOWED_RANGES.some(range => isIpInCidr(clientIp, range));

  if (!isAllowed) {
    res.status(403).json({ error: 'Forbidden', message: '注册仅限内网访问', requestId: req.requestId });
    return;
  }
  next();
}
