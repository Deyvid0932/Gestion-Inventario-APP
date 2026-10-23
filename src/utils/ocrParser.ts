export interface ExtractedGarmentOCR {
  id: string;
  op: string;
  style: string;
  color: string;
  box_id: string;
  status: number;
  created_at: string;
}

export const processOCRText = (rawText: string, boxId: string): ExtractedGarmentOCR[] => {
    const normalizedText = rawText.replace(/[|\\/]/g, ' ');
    const lines = normalizedText.split('\n');
    const now = Date.now();

    const items = lines.map((line, index) => {
        const cleanLine = line.trim().toUpperCase();
        const styleRegex = /(KH[A-Z]*)\s*([0-9OQ]{3})\s*([0-9OQ]{2,3})/i;

        const match = cleanLine.match(styleRegex);

        if (match) {
            let [fullMatch, prefix, part1, part2] = match;

            const normalizeNumbers = (text: string) =>
                text.replace(/[OQ]/g, '0').replace(/[IL]/g, '1');

            const styleFinal = `${prefix} ${normalizeNumbers(part1)} ${normalizeNumbers(part2)}`.trim();

            const styleIndex = cleanLine.indexOf(fullMatch);

            const prevText = cleanLine.substring(0, styleIndex).trim();
            let opFinal = '';

            if (prevText) {
                const opMatch = prevText.match(/([0-9OQIL]{4,10})/i);
                if (opMatch) {
                    opFinal = normalizeNumbers(opMatch[0]);
                }
            }

            if (!opFinal) {
                const opExplicit = cleanLine.match(/(?:OP|O\.P\.|0P|LOTE)\s*[:\-]?\s*([0-9OQIL]{4,10})/i);
                if (opExplicit) {
                    opFinal = normalizeNumbers(opExplicit[1]);
                }
            }

            const remainderLine = cleanLine.substring(styleIndex + fullMatch.length);
            const colorClean = remainderLine.replace(/^[:\-\|\s]+/, '').trim();
            const colorFinal = colorClean.length > 0 ? colorClean : "S/C";

            const invertedIndex = (lines.length - index).toString().padStart(3, '0');
            const timeOffsetMs = lines.length - index;
            const createdAt = new Date(now + timeOffsetMs).toISOString();

            return {
                id: `${now}_${invertedIndex}_${Math.random().toString(36).substring(2, 5)}`,
                op: opFinal,
                style: styleFinal,
                color: colorFinal,
                box_id: boxId,
                status: 1,
                created_at: createdAt
            };
        }

        return null;
    });

    return items.filter((item): item is ExtractedGarmentOCR => item !== null);
};

export const extractLabelData = (rawText: string) => {
    const normalizedText = rawText.replace(/[|\\/]/g, ' ').toUpperCase();
    const result = { op: '', style: '', color: '' };

    const styleRegex = /(KH[A-Z]*)\s*([0-9OQ]{3})\s*([0-9OQ]{2,3})/i;
    const styleMatch = normalizedText.match(styleRegex);
    if (styleMatch) {
        const normalizeNumbers = (text: string) => text.replace(/[OQ]/g, '0').replace(/[IL]/g, '1');
        result.style = `${styleMatch[1]} ${normalizeNumbers(styleMatch[2])} ${normalizeNumbers(styleMatch[3])}`.trim();

        const idx = normalizedText.indexOf(styleMatch[0]);
        const prevText = normalizedText.substring(0, idx).trim();
        const opMatchPrev = prevText.match(/([0-9OQIL]{4,10})/i);
        if (opMatchPrev) {
            result.op = normalizeNumbers(opMatchPrev[0]);
        }

        const remainder = normalizedText.substring(idx + styleMatch[0].length).replace(/^[:\-\|\s]+/, '').trim();
        if (remainder) {
            result.color = remainder;
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