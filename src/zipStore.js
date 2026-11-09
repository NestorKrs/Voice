const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i += 1) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function toU8(bytes) {
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
}

function concatBytes(parts) {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

function buildLocalHeader(nameBytes, crc, size) {
  const out = new Uint8Array(30 + nameBytes.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x04034b50, true);
  v.setUint16(4, 20, true);
  v.setUint16(6, 0x0800, true);
  v.setUint16(8, 0, true);
  v.setUint16(10, 0, true);
  v.setUint16(12, 0x0021, true);
  v.setUint32(14, crc, true);
  v.setUint32(18, size, true);
  v.setUint32(22, size, true);
  v.setUint16(26, nameBytes.length, true);
  v.setUint16(28, 0, true);
  out.set(nameBytes, 30);
  return out;
}

function buildCentralHeader(nameBytes, crc, size, offset) {
  const out = new Uint8Array(46 + nameBytes.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x02014b50, true);
  v.setUint16(4, 20, true);
  v.setUint16(6, 20, true);
  v.setUint16(8, 0x0800, true);
  v.setUint16(10, 0, true);
  v.setUint16(12, 0, true);
  v.setUint16(14, 0x0021, true);
  v.setUint32(16, crc, true);
  v.setUint32(20, size, true);
  v.setUint32(24, size, true);
  v.setUint16(28, nameBytes.length, true);
  v.setUint16(30, 0, true);
  v.setUint16(32, 0, true);
  v.setUint16(34, 0, true);
  v.setUint16(36, 0, true);
  v.setUint32(38, 0, true);
  v.setUint32(42, offset, true);
  out.set(nameBytes, 46);
  return out;
}

function buildEndRecord(entryCount, centralSize, centralOffset) {
  const out = new Uint8Array(22);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(4, 0, true);
  v.setUint16(6, 0, true);
  v.setUint16(8, entryCount, true);
  v.setUint16(10, entryCount, true);
  v.setUint32(12, centralSize, true);
  v.setUint32(16, centralOffset, true);
  v.setUint16(20, 0, true);
  return out;
}

export function createZip(files) {
  const enc = new TextEncoder();
  const central = [];
  const pieces = [];
  let offset = 0;
  for (const { name, bytes } of files) {
    const nameBytes = enc.encode(name);
    const u8 = toU8(bytes);
    const crc = crc32(u8);
    const local = buildLocalHeader(nameBytes, crc, u8.length);
    pieces.push(local, u8);
    central.push(buildCentralHeader(nameBytes, crc, u8.length, offset));
    offset += local.length + u8.length;
  }
  const centralBytes = concatBytes(central);
  pieces.push(centralBytes);
  pieces.push(buildEndRecord(files.length, centralBytes.length, offset));
  return concatBytes(pieces);
}

export async function* zipChunks(files, onProgress) {
  const enc = new TextEncoder();
  const central = [];
  let offset = 0;
  for (let i = 0; i < files.length; i += 1) {
    const { name, bytes } = files[i];
    const nameBytes = enc.encode(name);
    const u8 = toU8(bytes);
    const crc = crc32(u8);
    const local = buildLocalHeader(nameBytes, crc, u8.length);
    yield local;
    yield u8;
    central.push(buildCentralHeader(nameBytes, crc, u8.length, offset));
    offset += local.length + u8.length;
    if (onProgress) onProgress(i + 1, files.length);
  }
  const centralBytes = concatBytes(central);
  yield centralBytes;
  yield buildEndRecord(files.length, centralBytes.length, offset);
}
