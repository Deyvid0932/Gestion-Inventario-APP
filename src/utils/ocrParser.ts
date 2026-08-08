export const processOCRText = (rawText: string, cajaId: string) => {
    const normalizedText = rawText.replace(/[|\\/]/g, ' ');
    const lines = normalizedText.split('\n');
    const now = Date.now();

    return lines.map((line, index) => {
        const cleanLine = line.trim().toUpperCase();
        const estiloRegex = /(KH[A-Z]*)\s*([0-9OQ]{3})\s*([0-9OQ]{2,3})/i;

        const match = cleanLine.match(estiloRegex);

        if (match) {
            let [fullMatch, prefix, part1, part2] = match;

            const normalizeNumbers = (text: string) =>
                text.replace(/[OQ]/g, '0').replace(/[IL]/g, '1');

            const estiloFinal = `${prefix} ${normalizeNumbers(part1)} ${normalizeNumbers(part2)}`.trim();

            const estiloIndex = cleanLine.indexOf(fullMatch);

            const textoPrevio = cleanLine.substring(0, estiloIndex).trim();
            let opFinal = '';

            if (textoPrevio) {
                const opMatch = textoPrevio.match(/([0-9OQIL]{4,10})/i);
                if (opMatch) {
                    opFinal = normalizeNumbers(opMatch[0]);
                }
            }

            const restoDeLinea = cleanLine.substring(estiloIndex + fullMatch.length);
            const colorClean = restoDeLinea.replace(/^[:\-\|\s]+/, '').trim();
            const colorFinal = colorClean.length > 0 ? colorClean : "S/C";

            const invertedIndex = (lines.length - index).toString().padStart(3, '0');
            const timeOffsetMs = lines.length - index;
            const createdAt = new Date(now + timeOffsetMs).toISOString();

            return {
                id: `${now}_${invertedIndex}_${Math.random().toString(36).substring(2, 5)}`,
                op: opFinal,
                estilo: estiloFinal,
                color: colorFinal,
                cajaId: cajaId,
                estado: 1,
                fechaCreacion: createdAt
            };
        }

        return null;
    }).filter(item => item !== null);
};

export const extractLabelData = (rawText: string) => {
    const normalizedText = rawText.replace(/[|\\/]/g, ' ').toUpperCase();
    const result = { op: '', estilo: '', color: '' };

    const estiloRegex = /(KH[A-Z]*)\s*([0-9OQ]{3})\s*([0-9OQ]{2,3})/i;
    const estiloMatch = normalizedText.match(estiloRegex);
    if (estiloMatch) {
        const normalizeNumbers = (text: string) => text.replace(/[OQ]/g, '0').replace(/[IL]/g, '1');
        result.estilo = `${estiloMatch[1]} ${normalizeNumbers(estiloMatch[2])} ${normalizeNumbers(estiloMatch[3])}`.trim();

        const idx = normalizedText.indexOf(estiloMatch[0]);
        const antesDelEstilo = normalizedText.substring(0, idx).trim();
        const opMatchPrev = antesDelEstilo.match(/([0-9OQIL]{4,10})/i);
        if (opMatchPrev) {
            result.op = normalizeNumbers(opMatchPrev[0]);
        }

        const despuesDelEstilo = normalizedText.substring(idx + estiloMatch[0].length).replace(/^[:\-\|\s]+/, '').trim();
        if (despuesDelEstilo) {
            result.color = despuesDelEstilo;
        }
    }

    if (!result.color) {
        const colorRegex = /((?:BL|WHI|WH|NOC|SAN|SUN|CYC|LHE|SIL|SI|MYS|HER|KIN|LAY|NAV|TUR|TU|VOY|VO|EQU|STA|SAS|B\.Q\.|BQ)[A-Z0-9\s\(\)\/\.\-]+)/i;
        const colorMatch = normalizedText.match(colorRegex);
        if (colorMatch) {
            result.color = colorMatch[0].trim();
        }
    }

    if (!result.op) {
        const opRegex = /(?:OP|O\.P\.|0P)\s*[:\-]?\s*([0-9OQIL]{4,10})/i;
        const opMatch = normalizedText.match(opRegex);
        if (opMatch) {
            const normalizeNumbers = (text: string) => text.replace(/[OQ]/g, '0').replace(/[IL]/g, '1');
            result.op = normalizeNumbers(opMatch[1].trim());
        }
    }

    return result;
};