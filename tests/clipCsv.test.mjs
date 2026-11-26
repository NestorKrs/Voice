import test from 'node:test';
import assert from 'node:assert/strict';
import { csvEscape, buildCutListCsv } from '../src/clipCsv.js';

test('csvEscape leaves plain text unchanged', () => {
  assert.equal(csvEscape('Intro'), 'Intro');
  assert.equal(csvEscape(12), '12');
  assert.equal(csvEscape(''), '');
});

test('csvEscape quotes text containing a comma', () => {
  assert.equal(csvEscape('a,b'), '"a,b"');
});

test('csvEscape doubles inner double quotes', () => {
  assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
});

test('csvEscape quotes text containing CR or LF', () => {
  assert.equal(csvEscape('a\nb'), '"a\nb"');
  assert.equal(csvEscape('a\rb'), '"a\rb"');
  assert.equal(csvEscape('a\r\nb'), '"a\r\nb"');
});

test('csvEscape guards leading = + - @ and tab', () => {
  assert.equal(csvEscape('=1+1'), "'=1+1");
  assert.equal(csvEscape('+SUM(A1)'), "'+SUM(A1)");
  assert.equal(csvEscape('-2'), "'-2");
  assert.equal(csvEscape('@cmd'), "'@cmd");
  assert.equal(csvEscape('\tx'), "'\tx");
});

test('csvEscape handles a name with both a quote and a comma', () => {
  assert.equal(csvEscape('Bird, "take 2"'), '"Bird, ""take 2"""');
});

test('buildCutListCsv writes the exact header line for an empty list', () => {
  assert.equal(buildCutListCsv([], 1000), 'name,start_ms,end_ms,duration_ms,start_time,end_time\r\n');
});

test('buildCutListCsv writes two hand-computed clips at rate 1000', () => {
  const csv = buildCutListCsv([
    { name: 'Intro', start: 0, end: 1500 },
    { name: 'Outro', start: 2000, end: 3500 },
  ], 1000);
  assert.equal(csv, [
    'name,start_ms,end_ms,duration_ms,start_time,end_time\r\n',
    'Intro,0.000,1500.000,1500.000,0:00.000,0:01.500\r\n',
    'Outro,2000.000,3500.000,1500.000,0:02.000,0:03.500\r\n',
  ].join(''));
});

test('buildCutListCsv escapes names and ends every line with CRLF', () => {
  const csv = buildCutListCsv([{ name: 'Bird, "take 2"', start: 0, end: 500 }], 1000);
  const lines = csv.split('\r\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], 'name,start_ms,end_ms,duration_ms,start_time,end_time');
  assert.equal(lines[1], '"Bird, ""take 2""",0.000,500.000,500.000,0:00.000,0:00.500');
  assert.equal(lines[2], '');
  assert.match(csv, /\r\n$/);
});

test('buildCutListCsv does not modify its inputs', () => {
  const clips = [{ name: 'A', start: 0, end: 100 }, { name: 'B', end: 200, start: 100 }];
  const snapshot = JSON.parse(JSON.stringify(clips));
  buildCutListCsv(clips, 44100);
  assert.deepEqual(clips, snapshot);
});
