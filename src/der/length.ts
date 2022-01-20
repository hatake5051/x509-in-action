export type LengthOctets = Uint8Array & { _brand: 'LengthOctets' };

export const DERLengthOctets = {
  encode,
  decode,
};

function encode(contentsOctetLength: number): LengthOctets {
  if (contentsOctetLength < 128) {
    return new Uint8Array([contentsOctetLength]) as LengthOctets;
  }
  let len = contentsOctetLength;
  const lenList = [];
  const radix = 256;
  while (len >= radix) {
    lenList.push(len % radix);
    len = Math.floor(len / radix);
  }
  lenList.push(len);
  const lenListLength = lenList.length;
  const first_octet = (1 << 7) + lenListLength;
  return new Uint8Array([first_octet, ...lenList.reverse()]) as LengthOctets;
}

function decode(octets: LengthOctets): { contentsLength: number; entireLen: number } {
  if (octets[0] == null) throw new TypeError('正しい DER Length Octets を与えてください。');
  if (octets[0] < 128) {
    return { contentsLength: octets[0], entireLen: 1 };
  }
  const lenOctetsLength = octets[0] & 0x7f;
  let len = 0;
  for (let idx = 0; idx < lenOctetsLength; idx++) {
    const oct = octets[idx + 1];
    if (oct == null) throw new TypeError('DER Length Octets の encoding で long format error');
    len = (len << 8) + oct;
  }
  return { contentsLength: len, entireLen: lenOctetsLength + 1 };
}
