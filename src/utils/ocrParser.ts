export const processOCRText = (rawText: string, cajaId: string) => {
    // Cortamos el texto por saltos de línea
    const lines = rawText.split('\n');

    return lines.map((line) => {
        
        // Expresiones regulares para capturar los datos
        const estiloRegex = /(KH[A-Z]*\s\d{3}\s\d{3})/i;
       // const opRegex = /(?:OP|STYLE|REF|KHBB|KHK)[:\s-]*([A-Z0-9\s-]+)/i;
        const colorRegex = /((?:BL|WHI|WH|NOC|SAN|TU|SI|STA|CU|WHI|SO|MI|CUR|MIS)[a-z\s\(\)\/y]+)/i;

        // Capturamos coincidencias
        //const opMatch = line.match(opRegex);
        const estiloMatch = line.match(estiloRegex);

        const restoDeLinea = estiloMatch ? line.substring(line.indexOf(estiloMatch[0]) + estiloMatch[0].length) : "";
        const colorMatch = restoDeLinea.trim().match(colorRegex);

        const estiloFinal = estiloMatch ? estiloMatch[0].trim() : "";
        const colorFinal = colorMatch ? colorMatch[0].trim() : "";

        return {
            id: Math.random().toString(36).substring(2, 9),
            // op: opMatch ? opMatch[1].trim() : "",
            estilo: estiloFinal,
            color: colorFinal || "S/C",
            cajaId: cajaId,
            estado: 1
        };
    }).filter(item => item.estilo.length > 5);
};