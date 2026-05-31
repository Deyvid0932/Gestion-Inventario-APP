export const colorMap: Record<string, string> = {
  'celeste': '#51D1F6', 
  'sky blue': '#51D1F6',
  'rojo': '#FF3B30', 
  'red': '#FF3B30',
  'verde': '#34C759', 
  'green': '#34C759',
  'azul': '#007AFF', 
  'blue': '#007AFF',
  'amarillo': '#FFCC00', 
  'yellow': '#FFCC00',
  'negro': '#1C1C1E', 
  'black': '#1C1C1E',
  'blanco': '#FFFFFF', 
  'white': '#FFFFFF',
  'gris': '#8E8E93', 
  'gray': '#8E8E93',
  'naranja': '#FF9500', 
  'orange': '#FF9500',
  'rosa': '#FF2D55', 
  'pink': '#FF2D55',
  'cian': '#5AC8FA', 
  'cyan': '#5AC8FA',
  'coffee': '#6F4E37',
  'brown': '#A52A2A',
  'marron': '#800000',
  'morado': '#AF52DE',
  'purple': '#AF52DE',

  // --- Colores Nuevos (Detectados en Auditoría) ---
  'nocturnal': '#2C2C34',       // Azul noche muy oscuro
  'sandrift': '#BDB1A2',        // Arena / Beige cálido
  'sundrift': '#D2B48C',        // Tostado claro
  'sandstone': '#766D5B',       // Piedra oscuro
  'hermatite': '#4A4A4A',       // Gris metálico oscuro
  'cyclone': '#8D99AE',         // Gris azulado
  'light heather': '#D3D3D3',   // Gris jaspeado claro
  'mystic': '#4B0082',          // Indigo / Morado místico
  'kinoline': '#C5E063',        // Verde lima / Citrón
  'layer': '#E0E0E0',           // Gris capa base
  'navy blazer': '#06192E',     // Azul marino institucional
  'navy blue': '#000080',       // Azul marino estándar
  'turquesa': '#40E0D0',        // Turquesa
  'voyage': '#008080',          // Azul petróleo / Teal
  'equestrian': '#7B5C3E',      // Marrón cuero
  'stadium': '#354D73',         // Azul medio (estadio)
  'silk': '#F0EAD6',            // Crema / Seda
  'bright white': '#F9F9F9',    // Blanco brillante
  'black/white': '#2F2F2F',     // Gris muy oscuro (mezcla)
  'black y white': '#2F2F2F',   // Gris muy oscuro (mezcla)
};

export const getColorHex = (colorName: string | undefined | null) => {
  if (!colorName) return '#8E8E93';
  const lower = colorName.toLowerCase().trim();
  for (const [name, hex] of Object.entries(colorMap)) {
    if (lower.includes(name)) return hex;
  }
  return '#8E8E93';
};
