// Build a small JPEG with a real EXIF APP1 segment (camera make/model, datetime, GPS).
// Pure-Node, no deps. Produces /tmp/exif-sample.jpg.
import { writeFileSync } from 'fs';

// --- 1. Base JPEG: a tiny solid-colour baseline JPEG (8x8) encoded by hand is painful,
// so instead we generate the pixels via a minimal valid JPEG produced at runtime in the
// browser is not available here. Use a known-good 16x16 red baseline JPEG (base64).
// Generated once via canvas toDataURL('image/jpeg'); embedded here as the SOI..EOI stream.
const baseJpegB64 =
'/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy' +
'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAQABADASIA' +
'AhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQA' +
'AAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3' +
'ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWm' +
'p6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEA' +
'AwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSEx' +
'BhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElK' +
'U1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3' +
'uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iii' +
'gD//2Q==';

const baseJpeg = Buffer.from(baseJpegB64, 'base64');

// --- 2. Build EXIF TIFF block ---
// We'll build a little-endian TIFF: header + IFD0 + ExifIFD + GPS IFD + value area.
// Keep it simple: assemble offsets manually.

function u16le(n){ const b=Buffer.alloc(2); b.writeUInt16LE(n); return b; }
function u32le(n){ const b=Buffer.alloc(4); b.writeUInt32LE(n); return b; }

// Tag types
const ASCII=2, SHORT=3, LONG=4, RATIONAL=5;

// We construct the TIFF body after the 8-byte header. All offsets are relative to TIFF start.
const TIFF_HEADER_LEN = 8;

// Value blobs that don't fit in 4 bytes go into a value area appended after all IFDs.
let valueArea = Buffer.alloc(0);
function addValue(buf){
  const off = valueAreaBase + valueArea.length;
  valueArea = Buffer.concat([valueArea, buf]);
  // pad to even
  if (valueArea.length % 2) valueArea = Buffer.concat([valueArea, Buffer.from([0])]);
  return off;
}
function ascii(str){ return Buffer.from(str + '\0', 'latin1'); }
function rational(num, den){ const b=Buffer.alloc(8); b.writeUInt32LE(num,0); b.writeUInt32LE(den,4); return b; }
function rationals(arr){ return Buffer.concat(arr.map(([n,d])=>rational(n,d))); }

// Plan layout:
// [TIFF header 8]
// [IFD0]
// [ExifIFD]
// [GPS IFD]
// [value area]
// We need to know sizes to compute offsets. Compute IFD sizes first.

function ifdSize(nEntries){ return 2 + nEntries*12 + 4; }

const IFD0_OFF = TIFF_HEADER_LEN;            // 8
const IFD0_ENTRIES = 6;                       // Make, Model, Orientation, Software, DateTime, ExifIFDPointer, GPSPointer => 7 actually
// recount below

// --- IFD0 entries ---
const ifd0 = [];
const exif = [];
const gps = [];

// placeholder offsets, fix after we know layout
let IFD0_size, EXIF_OFF, EXIF_size, GPS_OFF, GPS_size, valueAreaBase;

// We'll do two-pass: define entries with value buffers, then lay out.
// Each entry: {tag, type, count, valueBuf}  (valueBuf is the actual data, may be >4 bytes)
function entry(tag, type, count, valueBuf){ return {tag,type,count,valueBuf}; }

const ifd0Entries = [
  entry(0x010F, ASCII, 0, ascii('Canon')),                 // Make
  entry(0x0110, ASCII, 0, ascii('Canon EOS R6')),          // Model
  entry(0x0112, SHORT, 1, u16le(1)),                       // Orientation = 1
  entry(0x0131, ASCII, 0, ascii('exif.mrzk.io demo')),     // Software
  entry(0x0132, ASCII, 0, ascii('2026:06:22 14:30:05')),   // DateTime
];
// fix counts for ascii (count = bytes including null)
for(const e of ifd0Entries){ if(e.type===ASCII) e.count = e.valueBuf.length; }

const exifEntries = [
  entry(0x829A, RATIONAL, 1, rational(1,250)),             // ExposureTime 1/250
  entry(0x829D, RATIONAL, 1, rational(28,10)),             // FNumber f/2.8
  entry(0x8827, SHORT, 1, u16le(100)),                     // ISO 100
  entry(0x9003, ASCII, 0, ascii('2026:06:22 14:30:05')),   // DateTimeOriginal
  entry(0x920A, RATIONAL, 1, rational(50,1)),              // FocalLength 50mm
  entry(0xA002, LONG, 1, u32le(16)),                       // PixelXDimension
  entry(0xA003, LONG, 1, u32le(16)),                       // PixelYDimension
];
for(const e of exifEntries){ if(e.type===ASCII) e.count = e.valueBuf.length; }

// GPS: Wellington, NZ approx -41.2865, 174.7762
const gpsEntries = [
  entry(0x0001, ASCII, 0, ascii('S')),                     // GPSLatitudeRef
  entry(0x0002, RATIONAL, 3, rationals([[41,1],[17,1],[1140,100]])), // 41 17 11.40
  entry(0x0003, ASCII, 0, ascii('E')),                     // GPSLongitudeRef
  entry(0x0004, RATIONAL, 3, rationals([[174,1],[46,1],[3432,100]])), // 174 46 34.32
];
for(const e of gpsEntries){ if(e.type===ASCII) e.count = e.valueBuf.length; }

// IFD0 also gets ExifIFDPointer(0x8769 LONG) and GPSPointer(0x8825 LONG) - added during layout.

// --- Layout pass ---
const typeSize = {2:1,3:2,4:4,5:8};
function entryDataLen(e){ return typeSize[e.type]*e.count; }
function fitsInline(e){ return entryDataLen(e) <= 4; }

// total IFD0 entries = ifd0Entries + 2 pointers
const ifd0Count = ifd0Entries.length + 2;
const exifCount = exifEntries.length;
const gpsCount = gpsEntries.length;

IFD0_size = ifdSize(ifd0Count);
EXIF_OFF = IFD0_OFF + IFD0_size;
EXIF_size = ifdSize(exifCount);
GPS_OFF = EXIF_OFF + EXIF_size;
GPS_size = ifdSize(gpsCount);
valueAreaBase = GPS_OFF + GPS_size;

// Now assign value offsets for non-inline entries (append into valueArea in order).
function assignOffsets(entries){
  for(const e of entries){
    if(!fitsInline(e)){
      e.offset = valueAreaBase + valueArea.length;
      let vb = e.valueBuf;
      valueArea = Buffer.concat([valueArea, vb]);
      if(valueArea.length % 2) valueArea = Buffer.concat([valueArea, Buffer.from([0])]);
    }
  }
}
assignOffsets(ifd0Entries);
assignOffsets(exifEntries);
assignOffsets(gpsEntries);

function serializeEntry(e){
  const b = Buffer.alloc(12);
  b.writeUInt16LE(e.tag, 0);
  b.writeUInt16LE(e.type, 2);
  b.writeUInt32LE(e.count, 4);
  if(fitsInline(e)){
    // copy value bytes, padded
    const v = Buffer.alloc(4);
    e.valueBuf.copy(v, 0, 0, Math.min(4, e.valueBuf.length));
    v.copy(b, 8);
  } else {
    b.writeUInt32LE(e.offset, 8);
  }
  return b;
}

function serializeIFD(entries, extraEntries, nextOffset){
  // extraEntries: array of pre-serialized 12-byte buffers (pointers)
  const all = entries.map(serializeEntry).concat(extraEntries||[]);
  const count = all.length;
  const head = u16le(count);
  const next = u32le(nextOffset||0);
  return Buffer.concat([head, ...all, next]);
}

// pointer entries for IFD0
function ptrEntry(tag, off){
  const b = Buffer.alloc(12);
  b.writeUInt16LE(tag,0); b.writeUInt16LE(LONG,2); b.writeUInt32LE(1,4); b.writeUInt32LE(off,8);
  return b;
}
const exifPtr = ptrEntry(0x8769, EXIF_OFF);
const gpsPtr  = ptrEntry(0x8825, GPS_OFF);

const ifd0Buf = serializeIFD(ifd0Entries, [exifPtr, gpsPtr], 0);
const exifBuf = serializeIFD(exifEntries, [], 0);
const gpsBuf  = serializeIFD(gpsEntries, [], 0);

// TIFF header (little-endian) + IFDs + value area
const tiffHeader = Buffer.concat([
  Buffer.from('II', 'latin1'),   // little endian
  u16le(42),
  u32le(IFD0_OFF)
]);

const tiff = Buffer.concat([tiffHeader, ifd0Buf, exifBuf, gpsBuf, valueArea]);

// EXIF APP1 = 0xFFE1, length, "Exif\0\0", tiff
const exifId = Buffer.from('Exif\0\0', 'latin1');
const app1Payload = Buffer.concat([exifId, tiff]);
const app1Len = app1Payload.length + 2; // includes the 2 length bytes
const app1 = Buffer.concat([
  Buffer.from([0xFF, 0xE1]),
  u16le(app1Len >> 8 << 8 | (app1Len & 0xff)) // big-endian length
]);
// JPEG marker lengths are big-endian; fix:
const app1LenBE = Buffer.alloc(2); app1LenBE.writeUInt16BE(app1Len);
const app1Segment = Buffer.concat([Buffer.from([0xFF,0xE1]), app1LenBE, app1Payload]);

// Insert APP1 right after SOI (first 2 bytes 0xFFD8) of baseJpeg.
if(baseJpeg[0] !== 0xFF || baseJpeg[1] !== 0xD8){ throw new Error('base not JPEG SOI'); }
const out = Buffer.concat([baseJpeg.slice(0,2), app1Segment, baseJpeg.slice(2)]);

writeFileSync('/tmp/exif-sample.jpg', out);
console.log('wrote /tmp/exif-sample.jpg', out.length, 'bytes; APP1', app1Segment.length);
