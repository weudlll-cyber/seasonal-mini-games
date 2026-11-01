/**
 * @file   apps/server/test/selfSignedCert.ts
 * @module server/test
 * @brief  A throw-away self-signed certificate for a local HTTPS test receiver.
 *
 * Responsibility: draw a P-256 key and write an X.509 v3 certificate for `localhost` and
 *                 127.0.0.1 (DER by hand, signed with node:crypto), valid for a day, so a test
 *                 can run an HTTPS server and trust exactly that certificate; nothing is stored
 *                 on disk or in the repository (no key for a secret scanner to find).
 * Depends on:     node:crypto
 * Used by:        ./webhooks.integration.test
 * Spec:           docs/spec/09-testing-strategy.md §2; Bingo 07 §5
 */
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';

const length = (n: number): number[] =>
  n < 0x80 ? [n] : n < 0x100 ? [0x81, n] : [0x82, n >> 8, n & 0xff];

const tlv = (tag: number, ...parts: Buffer[]): Buffer => {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([tag, ...length(body.length)]), body]);
};
const seq = (...parts: Buffer[]) => tlv(0x30, ...parts);

function oid(dotted: string): Buffer {
  const [a = 0, b = 0, ...rest] = dotted.split('.').map(Number);
  const bytes = [40 * a + b];
  for (const n of rest) {
    const chunk = [n & 0x7f];
    for (let v = n >> 7; v > 0; v >>= 7) chunk.unshift((v & 0x7f) | 0x80);
    bytes.push(...chunk);
  }
  return tlv(0x06, Buffer.from(bytes));
}

const utcTime = (d: Date): Buffer =>
  tlv(0x17, Buffer.from(`${d.toISOString().slice(2, 19).replace(/[-:T]/g, '')}Z`));

const ECDSA_SHA256 = '1.2.840.10045.4.3.2';
const TRUE = tlv(0x01, Buffer.from([0xff]));

function tbsCertificate(spki: Buffer): Buffer {
  const name = seq(tlv(0x31, seq(oid('2.5.4.3'), tlv(0x0c, Buffer.from('localhost')))));
  const serial = randomBytes(8);
  serial[0] = (serial[0] ?? 0) & 0x7f;
  const now = Date.now();
  const altNames = seq(tlv(0x82, Buffer.from('localhost')), tlv(0x87, Buffer.from([127, 0, 0, 1])));
  const extensions = seq(
    seq(oid('2.5.29.17'), tlv(0x04, altNames)),
    seq(oid('2.5.29.19'), TRUE, tlv(0x04, seq(TRUE))),
  );
  return seq(
    tlv(0xa0, tlv(0x02, Buffer.from([2]))),
    tlv(0x02, serial),
    seq(oid(ECDSA_SHA256)),
    name,
    seq(utcTime(new Date(now - 3_600_000)), utcTime(new Date(now + 24 * 3_600_000))),
    name,
    spki,
    tlv(0xa3, extensions),
  );
}

const pem = (label: string, der: Buffer): string =>
  `-----BEGIN ${label}-----\n${(der.toString('base64').match(/.{1,64}/g) ?? []).join('\n')}\n-----END ${label}-----\n`;

export function selfSignedCert(): { readonly cert: string; readonly key: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const tbs = tbsCertificate(publicKey.export({ type: 'spki', format: 'der' }));
  const signature = sign('sha256', tbs, privateKey);
  const der = seq(tbs, seq(oid(ECDSA_SHA256)), tlv(0x03, Buffer.from([0]), signature));
  return {
    cert: pem('CERTIFICATE', der),
    key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
}
