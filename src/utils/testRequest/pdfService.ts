import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import type { PDFFont, PDFPage, RGB } from 'pdf-lib';
import { TestRequestFormData } from './types';
import {
  PDF_TEXT_FIELDS,
  PDF_CHECKBOX_FIELDS,
} from './pdfCoordinates';

const PAGE_HEIGHT = 595.276;
const RIGHT_SIDE_OFFSET = 422.36;
let cachedTemplateBytes: Uint8Array | null = null;

// Decodificador base64 puro compatible con Hermes / JavaScriptCore
const decodeBase64ToBuffer = (base64: string): Uint8Array => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  let bufferLength = base64.length * 0.75;
  if (base64[base64.length - 1] === '=') {
    bufferLength--;
    if (base64[base64.length - 2] === '=') {
      bufferLength--;
    }
  }

  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < base64.length; i += 4) {
    const encoded1 = lookup[base64.charCodeAt(i)];
    const encoded2 = lookup[base64.charCodeAt(i + 1)];
    const encoded3 = lookup[base64.charCodeAt(i + 2)];
    const encoded4 = lookup[base64.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (encoded3 !== undefined && base64[i + 2] !== '=') {
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (encoded4 !== undefined && base64[i + 3] !== '=') {
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
  }

  return bytes;
};

const drawFormDataOnPage = (
  page: PDFPage,
  font: PDFFont,
  form: TestRequestFormData,
  offsetX: number,
  rgbFn: (r: number, g: number, b: number) => RGB
) => {
  // 1. Textos
  for (const f of PDF_TEXT_FIELDS) {
    const val = form[f.key];
    if (val === undefined || val === null || val === '') continue;

    const x = offsetX + f.x;
    const isComments = f.key === 'comentarios';
    const y = isComments
      ? PAGE_HEIGHT - (f.top + 11.3) + 1.5
      : PAGE_HEIGHT - (f.top + f.height) + 1.5;
    const isNum = f.key === 'solicitudNumero';

    // Ajustar tamaño si el texto es más largo que la raya para evitar que se salga
    let fontSize = f.fontSize;
    const textWidth = font.widthOfTextAtSize(String(val), fontSize);
    if (textWidth > f.width && !isComments) {
      fontSize = Math.max(5.5, fontSize * (f.width / textWidth));
    }

    page.drawText(String(val), {
      x,
      y,
      size: fontSize,
      font,
      maxWidth: isComments ? f.width : undefined,
      lineHeight: isComments ? 12.4 : undefined,
      color: isNum ? rgbFn(0.86, 0.15, 0.15) : rgbFn(0.08, 0.1, 0.15),
    });
  }

  // 2. Casillas de verificación (Checkboxes con X roja simple)
  for (const c of PDF_CHECKBOX_FIELDS) {
    if (!form[c.key]) continue;

    const centerX = offsetX + c.x + c.width / 2;
    const centerY = PAGE_HEIGHT - c.top - c.height / 2;

    page.drawText('X', {
      x: centerX - 3.2,
      y: centerY - 3.2,
      size: 8.5,
      font,
      color: rgbFn(0.86, 0.15, 0.15),
    });
  }
};

const clearRightHalf = (
  page: PDFPage,
  rgbFn: (r: number, g: number, b: number) => RGB
) => {
  // Cubre la mitad derecha en blanco puro para ahorrar tinta y permitir reutilizar la otra mitad de la hoja
  page.drawRectangle({
    x: 421.8,
    y: 0,
    width: 421,
    height: PAGE_HEIGHT,
    color: rgbFn(1, 1, 1),
  });
};

export const generateTestRequestPdfBase64 = async (
  forms: TestRequestFormData[]
): Promise<string> => {
  const pdfLibMod = require('pdf-lib');
  const pdfLib = pdfLibMod?.PDFDocument ? pdfLibMod : pdfLibMod?.default;
  const { PDFDocument, rgb, StandardFonts } = pdfLib;

  if (!cachedTemplateBytes) {
    const templateMod = require('./originalPdfTemplateBase64');
    const b64 =
      templateMod?.ORIGINAL_PDF_TEMPLATE_BASE64 ||
      templateMod?.default?.ORIGINAL_PDF_TEMPLATE_BASE64;
    cachedTemplateBytes = decodeBase64ToBuffer(b64);
  }
  const templateBytes = cachedTemplateBytes!;
  const mainDoc = await PDFDocument.load(templateBytes);
  const helveticaBold = await mainDoc.embedFont(StandardFonts.HelveticaBold);

  // Hoja 1: Izquierda (forms[0]), Derecha (forms[1] si existe, o blanco puro si es impar)
  const firstPage = mainDoc.getPages()[0];
  drawFormDataOnPage(firstPage, helveticaBold, forms[0], 0, rgb);

  if (forms.length > 1) {
    drawFormDataOnPage(firstPage, helveticaBold, forms[1], RIGHT_SIDE_OFFSET, rgb);
  } else {
    clearRightHalf(firstPage, rgb);
  }

  // Si hay más de 2 prendas seleccionadas, agregamos hojas 2x1 adicionales clonando la plantilla limpia
  const totalSheets = Math.ceil(forms.length / 2);
  for (let s = 1; s < totalSheets; s++) {
    const freshDoc = await PDFDocument.load(templateBytes);
    const [freshPage] = await mainDoc.copyPages(freshDoc, [0]);
    mainDoc.addPage(freshPage);

    const leftForm = forms[s * 2];
    const rightForm = forms[s * 2 + 1];

    if (leftForm) {
      drawFormDataOnPage(freshPage, helveticaBold, leftForm, 0, rgb);
    }
    if (rightForm) {
      drawFormDataOnPage(freshPage, helveticaBold, rightForm, RIGHT_SIDE_OFFSET, rgb);
    } else {
      clearRightHalf(freshPage, rgb);
    }
  }

  return await mainDoc.saveAsBase64({ dataUri: false, useObjectStreams: false });
};

// Alias compatible
export const generateAcroFormPdfBase64 = generateTestRequestPdfBase64;

export const exportTestRequestToPdf = async (
  forms: TestRequestFormData[],
  suggestedFileName: string = 'Solicitud_de_Ensayo'
): Promise<boolean> => {
  try {
    if (!forms || forms.length === 0) {
      Alert.alert('Atención', 'No hay prendas seleccionadas para la Solicitud de Ensayo.');
      return false;
    }

    // 1. Generar el PDF vectorial sobre la plantilla oficial original (100% nítida)
    const pdfBase64 = await generateTestRequestPdfBase64(forms);

    // 2. Guardar en el sistema de archivos del dispositivo usando expo-file-system/legacy
    const sanitizedFileName = suggestedFileName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const fileUri = `${FileSystem.cacheDirectory}${sanitizedFileName}.pdf`;
    await FileSystem.writeAsStringAsync(fileUri, pdfBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // 3. Compartir / Abrir directamente con el visor nativo de PDF (Adobe Acrobat, Drive, WhatsApp, etc.)
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: `${sanitizedFileName}.pdf`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert('PDF Generado', `El documento se guardó correctamente en:\n${fileUri}`);
    }
    return true;
  } catch (error: any) {
    console.error('Error generando Solicitud de Ensayo PDF:', error);
    Alert.alert('Error', error?.message || 'No se pudo generar el PDF de Solicitud de Ensayo.');
    return false;
  }
};
