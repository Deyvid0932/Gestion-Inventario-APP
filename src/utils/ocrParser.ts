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

            const colorRegex = /((?:BL|WHI|WH|NOC|SAN|SUN|CYC|LHE|SIL|SI|MYS|HER|KIN|LAY|NAV|TUR|TU|VOY|VO|EQU|STA|SAS|)[A-Z\s\(\)\/Y]+)/i;
            const restoDeLinea = cleanLine.substring(cleanLine.indexOf(fullMatch) + fullMatch.length);
            const colorMatch = restoDeLinea.trim().match(colorRegex);
            const colorFinal = colorMatch ? colorMatch[0].trim() : "S/C";
            const invertedIndex = (lines.length - index).toString().padStart(3, '0');
            const timeOffsetMs = lines.length - index;
            const createdAt = new Date(now + timeOffsetMs).toISOString();

            return {
                id: `${now}_${invertedIndex}_${Math.random().toString(36).substring(2, 5)}`,
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
    const result = { op: '', estilo: '', color: '', talla: '' };

    const estiloRegex = /(KH[A-Z]*)\s*([0-9OQ]{3})\s*([0-9OQ]{2,3})/i;
    const estiloMatch = normalizedText.match(estiloRegex);
    if (estiloMatch) {
        const normalizeNumbers = (text: string) => text.replace(/[OQ]/g, '0').replace(/[IL]/g, '1');
        result.estilo = `${estiloMatch[1]} ${normalizeNumbers(estiloMatch[2])} ${normalizeNumbers(estiloMatch[3])}`.trim();
    }

    const colorRegex = /((?:BL|WHI|WH|NOC|SAN|SUN|CYC|LHE|SIL|SI|MYS|HER|KIN|LAY|NAV|TUR|TU|VOY|VO|EQU|STA|SAS|)[A-Z\s\(\)\/Y]+)/i;
    // Attempt to extract color from the line with estilo if possible, otherwise global match
    const colorMatch = normalizedText.match(colorRegex);
    if (colorMatch) {
        result.color = colorMatch[0].trim();
    }

    const opRegex = /(?:OP|O\.P\.|0P)\s*[:\-]?\s*([A-Z0-9]+)/i;
    const opMatch = normalizedText.match(opRegex);
    if (opMatch) {
        result.op = opMatch[1].trim();
    }

    const tallaRegex = /(?:TALLA|SIZE|T)\s*[:\-]?\s*([A-Z0-9]+)/i;
    const tallaMatch = normalizedText.match(tallaRegex);
    if (tallaMatch) {
        // Simple sanity check for common sizes
        const extracted = tallaMatch[1].trim();
        if (/^(XS|S|M|L|XL|XXL|XXXL|[0-9]{1,2})$/i.test(extracted)) {
            result.talla = extracted;
        }
    }

    return result;
};