export const processOCRText = (rawText: string, cajaId: string) => {
    // Reemplazamos ruidos comunes antes de procesar
    const normalizedText = rawText.replace(/[|\\/]/g, ' '); 
    const lines = normalizedText.split('\n');
    const now = Date.now();

    return lines.map((line, index) => {
        const cleanLine = line.trim().toUpperCase();

        // REPRO MEJORADO: 
        // 1. Buscamos KH seguido de letras opcionales
        // 2. Para los números, permitimos (O, Q) como 0 y (I, L) como 1 temporalmente
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

            // Usamos un índice invertido para que lo de arriba de la foto tenga un ID mayor
            // y aparezca primero al ordenar por id DESC
            const invertedIndex = (lines.length - index).toString().padStart(3, '0');

            return {
                id: `${now}_${invertedIndex}_${Math.random().toString(36).substring(2, 5)}`,
                estilo: estiloFinal,
                color: colorFinal,
                cajaId: cajaId,
                estado: 1
            };
        }

        return null;
    }).filter(item => item !== null); 
};