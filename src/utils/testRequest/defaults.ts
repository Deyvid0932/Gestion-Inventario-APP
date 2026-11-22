import { TestRequestFormData } from './types';

export const createDefaultTestRequest = (garment?: {
  id?: string;
  style?: string;
  op?: string;
  color?: string;
  size?: string;
}): TestRequestFormData => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const formattedDate = `${day}/${month}/${year}`;

  return {
    id: garment?.id || '',
    fecha: formattedDate,
    solicitudNumero: '',

    area: 'Calidad Estampado',
    contacto: 'Rocio Valverde',
    direccion: 'Av. Santuario 1350 zarate.',
    email: 'cestampado@topitop',

    marca: 'Kith',
    color: garment?.color || '',
    estilo: garment?.style || '',
    tecnica: garment?.size || '',
    temporada: '',
    fabrica: 'Topytop',
    op: garment?.op || '',
    densidadBw: '',
    densidadAw: '',
    composicion: '',
    otro: '',

    muestraTela: false,
    muestraPrenda: true,
    muestraSwatch: false,
    muestraAvio: false,
    muestraOtros: false,
    muestraOtrosTexto: '',

    faseDesarrollo: false,
    faseMuestraVentas: false,
    faseTesting: false,
    faseProduccion: true,
    faseOtros: false,
    faseOtrosTexto: '',

    lavadoLavado: false,
    lavadoSinLavar: false,

    ensayoDensidadAstm: true,
    ensayoDensidadEn: false,
    ensayoExplosionAstm: false,
    ensayoExplosionIso: false,
    ensayoPillingAstm: false,
    ensayoPillingIso: false,
    ensayoAbrasionAstm: false,
    ensayoCursasColumnasAstm: false,

    solidezLavadoAatcc: false,
    solidezLavadoIso: false,
    solidezFroteAatcc: false,
    solidezFroteIso: false,
    solidezFroteGiratorioAatcc: false,
    solidezAguaAatcc: false,
    solidezAguaIso: false,
    solidezTranspiracionAatcc: false,
    solidezTranspiracionIso: false,
    solidezLuzAatcc: false,
    solidezAlmacenamientoOpc1: false,
    solidezAlmacenamientoOpc2: false,
    solidezBlanqueadorAatcc: false,
    solidezPhAatcc: false,
    solidezPhIso: false,

    cambioTejidosAatcc: false,
    cambioTejidosCiclos: '',
    cambioPrendasAatcc: false,
    cambioPrendasCiclos: '',
    cambioReviradoAatcc: false,
    cambioReviradoCiclos: '',
    cambioAparienciaAatcc: true,
    cambioAparienciaCiclos: '',

    cuidadoNormal: false,
    cuidadoDelicado: false,
    cuidadoPlanchado: false,
    cuidadoFrio: false,
    cuidadoTibio: false,
    cuidadoCaliente: false,
    cuidadoMuyCaliente: false,
    cuidadoTamborDelicado: false,
    cuidadoTamborNormal: false,
    cuidadoLinea: false,
    cuidadoPlano: false,

    comentarios: '',
  };
};
