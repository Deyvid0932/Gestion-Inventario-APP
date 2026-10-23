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
  'b.q.black': '#1C1C1E',       
  'b.q. black': '#1C1C1E',
  'bq black': '#1C1C1E',
  'black chincha': '#1C1C1E',
  'magma': '#C0392B',           
  'nocturnal': '#2C2C34',       
  'sandrift': '#BDB1A2',        
  'sundrift': '#D2B48C',        
  'sandstone': '#766D5B',       
  'hermatite': '#4A4A4A',       
  'cyclone': '#8D99AE',         
  'light heather': '#D3D3D3',   
  'mystic': '#4B0082',          
  'kinoline': '#C5E063',        
  'layer': '#E0E0E0',          
  'navy blazer': '#06192E',     
  'navy blue': '#000080',       
  'turquesa': '#40E0D0',        
  'voyage': '#008080',          
  'equestrian': '#7B5C3E',      
  'stadium': '#354D73',         
  'silk': '#F0EAD6',            
  'bright white': '#F9F9F9',    
  'white digital': '#F5F5F5',   
  'black/white': '#2F2F2F',     
  'black y white': '#2F2F2F',   
};

// Pre-calculado una sola vez en memoria a nivel de módulo (O(1) en tiempo de render)
const SORTED_COLOR_ENTRIES: [string, string][] = Object.entries(colorMap).sort((a, b) => b[0].length - a[0].length);

export const getColorHex = (colorName: string | undefined | null): string => {
  if (!colorName) return '#8E8E93';
  const lower = colorName.toLowerCase().trim();
  
  // Coincidencia directa O(1) si existe exactamente en el diccionario
  if (colorMap[lower]) {
    return colorMap[lower];
  }
  
  // Búsqueda substring sobre el array pre-ordenado sin re-ordenar
  for (let i = 0; i < SORTED_COLOR_ENTRIES.length; i++) {
    const [name, hex] = SORTED_COLOR_ENTRIES[i];
    if (lower.includes(name)) return hex;
  }
  return '#8E8E93';
};

