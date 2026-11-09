import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32, createZip, zipChunks } from '../src/zipStore.js';

const enc = new TextEncoder();

test('crc32 of "123456789" is 0xCBF43926', () => {
  assert.equal(crc32(enc.encode('123456789')), 0xCBF43926);
});

test('createZip writes a valid stored ZIP of two files', () => {
  const a = enc.encode('hello');
  const b = enc.encode('world!');
  const zip = createZip([{ name: 'a.txt', bytes: a }, { name: 'b.txt', bytes: b }]);
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  assert.equal(zip.byteLength, 205);
  assert.equal(v.getUint32(0, true), 0x04034b50);
  assert.equal(v.getUint16(8, true), 0);
  assert.equal(v.getUint32(14, true), crc32(a));
  assert.equal(v.getUint32(18, true), 5);
  assert.equal(v.getUint32(22, true), 5);
  assert.equal(v.getUint16(26, true), 5);
  assert.equal(String.fromCharCode(...zip.slice(30, 35)), 'a.txt');
  assert.equal(String.fromCharCode(...zip.slice(35, 40)), 'hello');
  assert.equal(v.getUint32(40, true), 0x04034b50);
  assert.equal(v.getUint32(54, true), crc32(b));
  assert.equal(v.getUint32(58, true), 6);
  assert.equal(v.getUint32(62, true), 6);
  assert.equal(v.getUint16(66, true), 5);
  assert.equal(String.fromCharCode(...zip.slice(70, 75)), 'b.txt');
  assert.equal(String.fromCharCode(...zip.slice(75, 81)), 'world!');
  assert.equal(v.getUint32(81, true), 0x02014b50);
  assert.equal(v.getUint32(81 + 16, true), crc32(a));
  assert.equal(v.getUint32(81 + 42, true), 0);
  assert.equal(v.getUint32(81 + 51, true), 0x02014b50);
  assert.equal(v.getUint32(81 + 51 + 42, true), 40);
  assert.equal(v.getUint32(183, true), 0x06054b50);
  assert.equal(v.getUint16(183 + 10, true), 2);
  assert.equal(v.getUint32(183 + 12, true), 102);
  assert.equal(v.getUint32(183 + 16, true), 81);
});

test('createZip with an empty list is a valid empty ZIP', () => {
  const zip = createZip([]);
  assert.equal(zip.byteLength, 22);
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  assert.equal(v.getUint32(0, true), 0x06054b50);
  assert.equal(v.getUint16(8, true), 0);
  assert.equal(v.getUint16(10, true), 0);
  assert.equal(v.getUint32(12, true), 0);
  assert.equal(v.getUint32(16, true), 0);
});

test('names with non-ASCII characters are stored as UTF-8', () => {
  const name = 'café-ü.txt';
  const zip = createZip([{ name, bytes: new Uint8Array([1]) }]);
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  assert.equal(v.getUint16(6, true) & 0x0800, 0x0800);
  const nameLen = v.getUint16(26, true);
  assert.deepEqual([...zip.slice(30, 30 + nameLen)], [...enc.encode(name)]);
});

test('zipChunks streams the same bytes as createZip and reports progress', async () => {
  const files = [{ name: 'a.txt', bytes: enc.encode('hello') }, { name: 'b.txt', bytes: enc.encode('world!') }];
  const pieces = [];
  let progress = '';
  for await (const piece of zipChunks(files, (done, total) => { progress = done + '/' + total; })) pieces.push(piece);
  const streamed = new Uint8Array(pieces.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of pieces) { streamed.set(p, o); o += p.length; }
  assert.deepEqual([...streamed], [...createZip(files)]);
  assert.equal(progress, '2/2');
});
