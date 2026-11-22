export interface TestRequestFormData {
  id?: string;
  fecha: string;
  solicitudNumero: string;

  // Solicitante
  area: string;
  contacto: string;
  direccion: string;
  email: string;

  // Muestra
  marca: string;
  color: string;
  estilo: string;
  tecnica: string;
  temporada: string;
  fabrica: string;
  op: string;
  densidadBw: string;
  densidadAw: string;
  composicion: string;
  otro: string;

  // Tipo de Muestra
  muestraTela: boolean;
  muestraPrenda: boolean; // default true
  muestraSwatch: boolean;
  muestraAvio: boolean;
  muestraOtros: boolean;
  muestraOtrosTexto: string;

  // Fase
  faseDesarrollo: boolean;
  faseMuestraVentas: boolean;
  faseTesting: boolean;
  faseProduccion: boolean; // default true
  faseOtros: boolean;
  faseOtrosTexto: string;

  // Lavado
  lavadoLavado: boolean;
  lavadoSinLavar: boolean;

  // Ensayos Físicos
  ensayoDensidadAstm: boolean; // default true
  ensayoDensidadEn: boolean;
  ensayoExplosionAstm: boolean;
  ensayoExplosionIso: boolean;
  ensayoPillingAstm: boolean;
  ensayoPillingIso: boolean;
  ensayoAbrasionAstm: boolean;
  ensayoCursasColumnasAstm: boolean;

  // Solideces & pH
  solidezLavadoAatcc: boolean;
  solidezLavadoIso: boolean;
  solidezFroteAatcc: boolean;
  solidezFroteIso: boolean;
  solidezFroteGiratorioAatcc: boolean;
  solidezAguaAatcc: boolean;
  solidezAguaIso: boolean;
  solidezTranspiracionAatcc: boolean;
  solidezTranspiracionIso: boolean;
  solidezLuzAatcc: boolean;
  solidezAlmacenamientoOpc1: boolean;
  solidezAlmacenamientoOpc2: boolean;
  solidezBlanqueadorAatcc: boolean;
  solidezPhAatcc: boolean;
  solidezPhIso: boolean;

  // Cambio dimensional & lavado
  cambioTejidosAatcc: boolean;
  cambioTejidosCiclos: string;
  cambioPrendasAatcc: boolean;
  cambioPrendasCiclos: string;
  cambioReviradoAatcc: boolean;
  cambioReviradoCiclos: string;
  cambioAparienciaAatcc: boolean; // default true
  cambioAparienciaCiclos: string;

  // Instrucciones cuidado
  cuidadoNormal: boolean;
  cuidadoDelicado: boolean;
  cuidadoPlanchado: boolean;
  cuidadoFrio: boolean;
  cuidadoTibio: boolean;
  cuidadoCaliente: boolean;
  cuidadoMuyCaliente: boolean;
  cuidadoTamborDelicado: boolean;
  cuidadoTamborNormal: boolean;
  cuidadoLinea: boolean;
  cuidadoPlano: boolean;

  // Observaciones
  comentarios: string;
}
