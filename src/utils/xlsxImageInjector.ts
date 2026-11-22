import * as XLSX from 'xlsx-js-style';

export interface XlsxImagePlacement {
  /** 1-based worksheet index (sheet1.xml = 1, sheet2.xml = 2, ...) */
  sheetIndex: number;
  /** 0-based row index in the worksheet */
  row: number;
  /** 0-based column index in the worksheet */
  col: number;
  /** Raw JPEG base64 (without data URI prefix) */
  base64: string;
  /** Optional image pixel dimensions to preserve aspect ratio */
  width?: number;
  height?: number;
}

const EMU_PER_PIXEL = 9525;
const CELL_PAD_EMU = 4 * EMU_PER_PIXEL;
const MAX_BOX_PX = 82;
const TARGET_COL_PX = 132; // ~wch 18
const TARGET_ROW_PX = 100; // hpt 75

const base64ToUint8Array = (base64: string): Uint8Array => {
  const clean = base64.replace(/^data:image\/\w+;base64,/, '').replace(/\s+/g, '');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  let len = clean.length * 0.75;
  if (clean.endsWith('==')) len -= 2;
  else if (clean.endsWith('=')) len -= 1;

  const bytes = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const e1 = lookup[clean.charCodeAt(i)];
    const e2 = lookup[clean.charCodeAt(i + 1)];
    const e3 = lookup[clean.charCodeAt(i + 2)];
    const e4 = lookup[clean.charCodeAt(i + 3)];
    bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (clean[i + 2] !== '=') bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (clean[i + 3] !== '=') bytes[p++] = ((e3 & 3) << 6) | (e4 & 63);
  }
  return bytes;
};

const utf8ToBytes = (str: string): Uint8Array => {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }
  const encoded = unescape(encodeURIComponent(str));
  const bytes = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) bytes[i] = encoded.charCodeAt(i);
  return bytes;
};

const bytesToUtf8 = (bytes: Uint8Array | number[]): string => {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(arr);
  }
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return decodeURIComponent(escape(s));
};

const findZipEntry = (zip: any, relativePath: string) => {
  const withSlash = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return XLSX.CFB.find(zip, withSlash) || XLSX.CFB.find(zip, relativePath);
};

const setZipEntry = (zip: any, relativePath: string, bytes: Uint8Array) => {
  const cleanRel = relativePath.replace(/^\/+/, '');
  const existing = findZipEntry(zip, cleanRel);
  if (existing) {
    existing.content = bytes as any;
    existing.size = bytes.length;
  } else {
    XLSX.CFB.utils.cfb_add(zip, cleanRel, bytes);
  }
};

/**
 * Inyecta imágenes JPEG reales dentro de un archivo .xlsx generado por SheetJS
 * usando las estructuras estándar OpenXML (`xl/media`, `xl/drawings`).
 */
export const injectImagesIntoXlsx = (
  xlsxBuffer: Uint8Array | ArrayBuffer,
  placements: XlsxImagePlacement[]
): string => {
  const rawBytes = xlsxBuffer instanceof Uint8Array ? xlsxBuffer : new Uint8Array(xlsxBuffer);
  const zip = XLSX.CFB.read(rawBytes, { type: 'array' });

  if (placements.length === 0) {
    return XLSX.CFB.write(zip, { fileType: 'zip', type: 'base64' }) as string;
  }

  // Agrupar imágenes por hoja (1-based)
  const bySheet = new Map<number, XlsxImagePlacement[]>();
  for (const p of placements) {
    if (!bySheet.has(p.sheetIndex)) bySheet.set(p.sheetIndex, []);
    bySheet.get(p.sheetIndex)!.push(p);
  }

  let globalMediaIndex = 1;
  const drawingOverrides: string[] = [];

  for (const [sheetIdx, items] of Array.from(bySheet.entries())) {
    const drawingPath = `/xl/drawings/drawing${sheetIdx}.xml`;
    drawingOverrides.push(
      `<Override PartName="${drawingPath}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`
    );

    const drawingRels: string[] = [];
    const anchors: string[] = [];

    items.forEach((item, localIdx) => {
      const mediaIdx = globalMediaIndex++;
      const mediaPath = `xl/media/image${mediaIdx}.jpg`;
      const relId = `rId${localIdx + 1}`;

      setZipEntry(zip, mediaPath, base64ToUint8Array(item.base64));

      drawingRels.push(
        `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${mediaIdx}.jpg"/>`
      );

      const w = item.width || 1;
      const h = item.height || 1;
      const fitScale = Math.min(MAX_BOX_PX / w, MAX_BOX_PX / h);
      const drawW = Math.max(20, Math.round(w * fitScale));
      const drawH = Math.max(20, Math.round(h * fitScale));
      const drawWEmu = drawW * EMU_PER_PIXEL;
      const drawHEmu = drawH * EMU_PER_PIXEL;
      const startColOff = Math.max(CELL_PAD_EMU, Math.round((TARGET_COL_PX - drawW) / 2) * EMU_PER_PIXEL);
      const startRowOff = Math.max(CELL_PAD_EMU, Math.round((TARGET_ROW_PX - drawH) / 2) * EMU_PER_PIXEL);
      const endColOff = startColOff + drawWEmu;
      const endRowOff = startRowOff + drawHEmu;

      anchors.push(
        `<xdr:twoCellAnchor editAs="oneCell">` +
          `<xdr:from><xdr:col>${item.col}</xdr:col><xdr:colOff>${startColOff}</xdr:colOff><xdr:row>${item.row}</xdr:row><xdr:rowOff>${startRowOff}</xdr:rowOff></xdr:from>` +
          `<xdr:to><xdr:col>${item.col}</xdr:col><xdr:colOff>${endColOff}</xdr:colOff><xdr:row>${item.row}</xdr:row><xdr:rowOff>${endRowOff}</xdr:rowOff></xdr:to>` +
          `<xdr:pic>` +
            `<xdr:nvPicPr><xdr:cNvPr id="${mediaIdx}" name="Imagen ${mediaIdx}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>` +
            `<xdr:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
            `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${drawWEmu}" cy="${drawHEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>` +
          `</xdr:pic>` +
          `<xdr:clientData/>` +
        `</xdr:twoCellAnchor>`
      );
    });

    const drawingXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      anchors.join('') +
      `</xdr:wsDr>`;

    const drawingRelsXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      drawingRels.join('') +
      `</Relationships>`;

    setZipEntry(zip, `xl/drawings/drawing${sheetIdx}.xml`, utf8ToBytes(drawingXml));
    setZipEntry(zip, `xl/drawings/_rels/drawing${sheetIdx}.xml.rels`, utf8ToBytes(drawingRelsXml));

    // Vincular hoja -> drawing
    const sheetRelsPath = `xl/worksheets/_rels/sheet${sheetIdx}.xml.rels`;
    const sheetRelEntry = findZipEntry(zip, sheetRelsPath);
    const drawingRelTag = `<Relationship Id="rIdDrawing" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${sheetIdx}.xml"/>`;
    if (sheetRelEntry && sheetRelEntry.content) {
      const existingRels = bytesToUtf8(sheetRelEntry.content as Uint8Array);
      const updatedRels = existingRels.replace('</Relationships>', `${drawingRelTag}</Relationships>`);
      setZipEntry(zip, sheetRelsPath, utf8ToBytes(updatedRels));
    } else {
      const newRels =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${drawingRelTag}</Relationships>`;
      setZipEntry(zip, sheetRelsPath, utf8ToBytes(newRels));
    }

    // Agregar <drawing r:id="rIdDrawing"/> al XML de la hoja
    const sheetPath = `xl/worksheets/sheet${sheetIdx}.xml`;
    const sheetEntry = findZipEntry(zip, sheetPath);
    if (sheetEntry && sheetEntry.content) {
      let sheetXml = bytesToUtf8(sheetEntry.content as Uint8Array);
      if (!sheetXml.includes('xmlns:r=')) {
        sheetXml = sheetXml.replace(
          '<worksheet ',
          '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        );
      }
      if (!sheetXml.includes('rIdDrawing')) {
        sheetXml = sheetXml.replace('</worksheet>', '<drawing r:id="rIdDrawing"/></worksheet>');
      }
      setZipEntry(zip, sheetPath, utf8ToBytes(sheetXml));
    }
  }

  // Registrar extensión jpg y overrides de drawings en [Content_Types].xml
  const contentTypesPath = '[Content_Types].xml';
  const ctEntry = findZipEntry(zip, contentTypesPath);
  if (ctEntry && ctEntry.content) {
    let ctXml = bytesToUtf8(ctEntry.content as Uint8Array);
    if (!ctXml.includes('Extension="jpg"')) {
      ctXml = ctXml.replace('</Types>', '<Default Extension="jpg" ContentType="image/jpeg"/></Types>');
    }
    ctXml = ctXml.replace('</Types>', `${drawingOverrides.join('')}</Types>`);
    setZipEntry(zip, contentTypesPath, utf8ToBytes(ctXml));
  }

  return XLSX.CFB.write(zip, { fileType: 'zip', type: 'base64' }) as string;
};
