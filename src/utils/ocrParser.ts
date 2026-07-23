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