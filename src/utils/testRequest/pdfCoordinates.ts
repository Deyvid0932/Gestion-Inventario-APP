import { TestRequestFormData } from './types';

export const PDF_HALF_WIDTH = 420.945;
export const PDF_HALF_HEIGHT = 595.276;

export interface PdfFieldCoordinate {
  key: keyof TestRequestFormData;
  label: string;
  section: string;
  x: number;
  top: number;
  width: number;
  height: number;
  fontSize: number;
  align?: 'left' | 'center' | 'right';
}

export interface PdfCheckboxCoordinate {
  key: keyof TestRequestFormData;
  label: string;
  section: string;
  x: number;
  top: number;
  width: number;
  height: number;
}

export const PDF_TEXT_FIELDS: PdfFieldCoordinate[] = [
  // 1. Cabecera
  { key: 'solicitudNumero', label: 'Solicitud N°', section: 'Cabecera', x: 258, top: 50, width: 62, height: 12, fontSize: 8.5 },
  { key: 'fecha', label: 'Fecha', section: 'Cabecera', x: 337, top: 39.6, width: 44, height: 12, fontSize: 7, align: 'center' },

  // 2. Solicitante
  { key: 'area', label: 'Área', section: 'Solicitante', x: 80, top: 85.2, width: 101, height: 12, fontSize: 7 },
  { key: 'contacto', label: 'Contacto', section: 'Solicitante', x: 257, top: 85.2, width: 124, height: 12, fontSize: 7 },
  { key: 'direccion', label: 'Dirección', section: 'Solicitante', x: 80, top: 98.8, width: 101, height: 12, fontSize: 7 },
  { key: 'email', label: 'E-mail', section: 'Solicitante', x: 257, top: 98.8, width: 124, height: 12, fontSize: 7 },

  // 3. Muestra
  { key: 'marca', label: 'Marca', section: 'Muestra', x: 80, top: 128.0, width: 101, height: 12, fontSize: 7 },
  { key: 'color', label: 'Color', section: 'Muestra', x: 252, top: 128.0, width: 129, height: 12, fontSize: 7 },
  { key: 'estilo', label: 'Estilo', section: 'Muestra', x: 80, top: 141.4, width: 101, height: 12, fontSize: 7 },
  { key: 'tecnica', label: 'Técnica', section: 'Muestra', x: 257, top: 141.4, width: 124, height: 12, fontSize: 7 },
  { key: 'temporada', label: 'Temporada', section: 'Muestra', x: 80, top: 154.6, width: 101, height: 12, fontSize: 7 },
  { key: 'fabrica', label: 'Fábrica', section: 'Muestra', x: 257, top: 154.6, width: 124, height: 12, fontSize: 7 },
  { key: 'op', label: 'OP', section: 'Muestra', x: 80, top: 168.0, width: 101, height: 12, fontSize: 7 },
  { key: 'densidadBw', label: 'Densidad BW (g/m²)', section: 'Muestra', x: 298, top: 168.0, width: 24, height: 12, fontSize: 6.5, align: 'center' },
  { key: 'densidadAw', label: 'Densidad AW (g/m²)', section: 'Muestra', x: 338, top: 168.0, width: 24, height: 12, fontSize: 6.5, align: 'center' },
  { key: 'composicion', label: 'Composición', section: 'Muestra', x: 80, top: 181.2, width: 101, height: 12, fontSize: 7 },
  { key: 'otro', label: 'Otro (Muestra)', section: 'Muestra', x: 245, top: 181.2, width: 78, height: 12, fontSize: 7 },

  // 4. Textos de otros
  { key: 'muestraOtrosTexto', label: 'Otros Tipo Muestra', section: 'Tipo de Muestra', x: 81, top: 243, width: 44, height: 11, fontSize: 6.5 },
  { key: 'faseOtrosTexto', label: 'Otros Fase', section: 'Fase', x: 253, top: 243, width: 65, height: 11, fontSize: 6.5 },

  // 5. Ciclos de lavado
  { key: 'cambioTejidosCiclos', label: 'Ciclos Tejidos', section: 'Cambio Dimensional', x: 283.5, top: 439.5, width: 30, height: 9.5, fontSize: 6.5, align: 'center' },
  { key: 'cambioPrendasCiclos', label: 'Ciclos Prendas', section: 'Cambio Dimensional', x: 283.5, top: 448.5, width: 30, height: 9.5, fontSize: 6.5, align: 'center' },
  { key: 'cambioReviradoCiclos', label: 'Ciclos Revirado', section: 'Cambio Dimensional', x: 283.5, top: 458.5, width: 30, height: 9.5, fontSize: 6.5, align: 'center' },
  { key: 'cambioAparienciaCiclos', label: 'Ciclos Apariencia', section: 'Cambio Dimensional', x: 283.5, top: 468.5, width: 30, height: 9.5, fontSize: 6.5, align: 'center' },

  // 6. Comentarios
  { key: 'comentarios', label: 'Comentarios / Observaciones', section: 'Observaciones', x: 128, top: 541, width: 208, height: 24, fontSize: 7 },
];

export const PDF_CHECKBOX_FIELDS: PdfCheckboxCoordinate[] = [
  // Tipo de Muestra
  { key: 'muestraTela', label: 'Tela', section: 'Tipo de Muestra', x: 61.5, top: 207.2, width: 18, height: 10 },
  { key: 'muestraPrenda', label: 'Prenda', section: 'Tipo de Muestra', x: 61.5, top: 217.1, width: 18, height: 10 },
  { key: 'muestraSwatch', label: 'Swatch', section: 'Tipo de Muestra', x: 61.5, top: 227.1, width: 18, height: 10 },
  { key: 'muestraAvio', label: 'Avío', section: 'Tipo de Muestra', x: 61.5, top: 237.0, width: 18, height: 10 },
  { key: 'muestraOtros', label: 'Otros (Muestra)', section: 'Tipo de Muestra', x: 61.5, top: 247.0, width: 18, height: 10 },

  // Fase
  { key: 'faseDesarrollo', label: 'Desarrollo', section: 'Fase', x: 216.4, top: 207.2, width: 13.2, height: 10 },
  { key: 'faseMuestraVentas', label: 'Muestra Ventas', section: 'Fase', x: 216.4, top: 217.1, width: 13.2, height: 10 },
  { key: 'faseTesting', label: 'Testing', section: 'Fase', x: 216.4, top: 227.1, width: 13.2, height: 10 },
  { key: 'faseProduccion', label: 'Producción', section: 'Fase', x: 216.4, top: 237.0, width: 13.2, height: 10 },
  { key: 'faseOtros', label: 'Otros (Fase)', section: 'Fase', x: 216.4, top: 247.0, width: 13.2, height: 10 },

  // Lavado
  { key: 'lavadoLavado', label: 'Lavado', section: 'Lavado', x: 322.7, top: 207.2, width: 13.8, height: 10 },
  { key: 'lavadoSinLavar', label: 'Sin Lavar', section: 'Lavado', x: 322.7, top: 217.1, width: 13.8, height: 10 },

  // Ensayos Físicos
  { key: 'ensayoDensidadAstm', label: 'Densidad ASTM D3776', section: 'Ensayos Físicos', x: 216.4, top: 282.5, width: 13.2, height: 10 },
  { key: 'ensayoDensidadEn', label: 'Densidad EN 12127', section: 'Ensayos Físicos', x: 322.7, top: 282.5, width: 13.8, height: 10 },
  { key: 'ensayoExplosionAstm', label: 'Explosión ASTM D3786', section: 'Ensayos Físicos', x: 216.4, top: 292.5, width: 13.2, height: 10 },
  { key: 'ensayoExplosionIso', label: 'Explosión ISO 13938-2', section: 'Ensayos Físicos', x: 322.7, top: 292.5, width: 13.8, height: 10 },
  { key: 'ensayoPillingAstm', label: 'Pilling ASTM D3512', section: 'Ensayos Físicos', x: 216.4, top: 302.4, width: 13.2, height: 10 },
  { key: 'ensayoPillingIso', label: 'Pilling ISO 12945-2', section: 'Ensayos Físicos', x: 322.7, top: 302.4, width: 13.8, height: 10 },
  { key: 'ensayoAbrasionAstm', label: 'Abrasión ASTM D4966', section: 'Ensayos Físicos', x: 216.4, top: 312.4, width: 13.2, height: 10 },
  { key: 'ensayoCursasColumnasAstm', label: 'Cursas ASTM D3887', section: 'Ensayos Físicos', x: 216.4, top: 322.3, width: 13.2, height: 10 },

  // Solideces & pH
  { key: 'solidezLavadoAatcc', label: 'Lavado AATCC TM61', section: 'Solideces', x: 216.4, top: 345.2, width: 13.2, height: 10 },
  { key: 'solidezLavadoIso', label: 'Lavado ISO 105 C06', section: 'Solideces', x: 299.4, top: 345.2, width: 13.2, height: 10 },
  { key: 'solidezPhAatcc', label: 'pH AATCC TM81', section: 'pH', x: 380.9, top: 345.2, width: 15.8, height: 10 },
  { key: 'solidezFroteAatcc', label: 'Frote AATCC TM8', section: 'Solideces', x: 216.4, top: 355.1, width: 13.2, height: 10 },
  { key: 'solidezFroteIso', label: 'Frote ISO 105 X12', section: 'Solideces', x: 299.4, top: 355.1, width: 13.2, height: 10 },
  { key: 'solidezPhIso', label: 'pH ISO 3071', section: 'pH', x: 380.9, top: 355.1, width: 15.8, height: 10 },
  { key: 'solidezFroteGiratorioAatcc', label: 'Frote Giratorio AATCC TM116', section: 'Solideces', x: 216.4, top: 365.1, width: 13.2, height: 10 },
  { key: 'solidezAguaAatcc', label: 'Agua AATCC TM107', section: 'Solideces', x: 216.4, top: 375.0, width: 13.2, height: 10 },
  { key: 'solidezAguaIso', label: 'Agua ISO 105 E01', section: 'Solideces', x: 299.4, top: 375.0, width: 13.2, height: 10 },
  { key: 'solidezTranspiracionAatcc', label: 'Transpiración AATCC TM15', section: 'Solideces', x: 216.4, top: 385.0, width: 13.2, height: 10 },
  { key: 'solidezTranspiracionIso', label: 'Transpiración ISO 105 E04', section: 'Solideces', x: 299.4, top: 385.0, width: 13.2, height: 10 },
  { key: 'solidezLuzAatcc', label: 'Luz AATCC TM16.3', section: 'Solideces', x: 216.4, top: 394.9, width: 13.2, height: 10 },
  { key: 'solidezAlmacenamientoOpc1', label: 'Almacenamiento Opc. 1', section: 'Solideces', x: 216.4, top: 404.9, width: 13.2, height: 10 },
  { key: 'solidezAlmacenamientoOpc2', label: 'Almacenamiento Opc. 2', section: 'Solideces', x: 283.1, top: 404.9, width: 16.3, height: 10 },
  { key: 'solidezBlanqueadorAatcc', label: 'Blanqueador AATCC TS-001', section: 'Solideces', x: 216.4, top: 414.8, width: 13.2, height: 10 },

  // Cambio Dimensional
  { key: 'cambioTejidosAatcc', label: 'Tejidos AATCC TM135', section: 'Cambio Dimensional', x: 216.4, top: 439.5, width: 13.2, height: 9.5 },
  { key: 'cambioPrendasAatcc', label: 'Prendas AATCC TM150', section: 'Cambio Dimensional', x: 216.4, top: 449.0, width: 13.2, height: 9.5 },
  { key: 'cambioReviradoAatcc', label: 'Revirado AATCC TM179', section: 'Cambio Dimensional', x: 216.4, top: 458.5, width: 13.2, height: 9.5 },
  { key: 'cambioAparienciaAatcc', label: 'Apariencia AATCC TM124', section: 'Cambio Dimensional', x: 216.4, top: 468.4, width: 13.2, height: 9.5 },

  // Instrucciones de Cuidado
  { key: 'cuidadoNormal', label: 'Cuidado Normal', section: 'Cuidado', x: 87.5, top: 504.1, width: 11.1, height: 8 },
  { key: 'cuidadoDelicado', label: 'Cuidado Delicado', section: 'Cuidado', x: 87.5, top: 512.1, width: 11.1, height: 8 },
  { key: 'cuidadoPlanchado', label: 'Cuidado Planchado', section: 'Cuidado', x: 87.5, top: 520.1, width: 11.1, height: 8 },
  { key: 'cuidadoFrio', label: 'Frío / Cold', section: 'Cuidado', x: 204.7, top: 504.1, width: 11.7, height: 8 },
  { key: 'cuidadoTibio', label: 'Tibio / Warm', section: 'Cuidado', x: 204.7, top: 512.1, width: 11.7, height: 8 },
  { key: 'cuidadoCaliente', label: 'Caliente / Hot', section: 'Cuidado', x: 204.7, top: 520.1, width: 11.7, height: 8 },
  { key: 'cuidadoMuyCaliente', label: 'Muy Caliente', section: 'Cuidado', x: 204.7, top: 528.1, width: 11.7, height: 8 },
  { key: 'cuidadoTamborDelicado', label: 'Tambor Delicado', section: 'Cuidado', x: 283.1, top: 504.1, width: 16.3, height: 8 },
  { key: 'cuidadoTamborNormal', label: 'Tambor Normal', section: 'Cuidado', x: 283.1, top: 512.1, width: 16.3, height: 8 },
  { key: 'cuidadoLinea', label: 'Línea', section: 'Cuidado', x: 283.1, top: 520.1, width: 16.3, height: 8 },
  { key: 'cuidadoPlano', label: 'Plano', section: 'Cuidado', x: 283.1, top: 528.1, width: 16.3, height: 8 },
];
