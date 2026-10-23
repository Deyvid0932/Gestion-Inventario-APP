import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeType } from '../../../styles/theme';
import { InventoryGroup } from '../../../hooks';

interface ExportInventoryAccordionProps {
  inv: InventoryGroup;
  index: number;
  totalItems: number;
  isExpanded: boolean;
  selectedBoxKeys: string[];
  currentTheme: ThemeType;
  onMovePosition: (direction: 'up' | 'down') => void;
  onToggleExpand: () => void;
  onToggleEntireSelection: () => void;
  onToggleSingleBox: (key: string) => void;
}

export const ExportInventoryAccordion: React.FC<ExportInventoryAccordionProps> = ({
  inv,
  index,
  totalItems,
  isExpanded,
  selectedBoxKeys,
  currentTheme,
  onMovePosition,
  onToggleExpand,
  onToggleEntireSelection,
  onToggleSingleBox,
}) => {
  const invKeys = inv.boxes.map(c => c.key);
  const selectedCountInInv = invKeys.filter(k => selectedBoxKeys.includes(k)).length;
  const isFullySelected = selectedCountInInv === invKeys.length;
  const isPartiallySelected = selectedCountInInv > 0 && selectedCountInInv < invKeys.length;

  return (
    <View
      style={[
        styles.inventoryCard,
        {
          backgroundColor: currentTheme.background,
          borderColor: isExpanded ? currentTheme.primary + '50' : currentTheme.border,
        },
      ]}
    >
      {/* Encabezado del Inventario / Lote */}
      <View style={styles.inventoryHeader}>
        {/* Controles de posición (Subir / Bajar) */}
        {totalItems > 1 && (
          <View style={styles.reorderBtnsColumn}>
            <TouchableOpacity
              disabled={index === 0}
              onPress={() => onMovePosition('up')}
              style={[styles.reorderBtn, { opacity: index === 0 ? 0.25 : 1 }]}
              accessibilityLabel="Mover lote arriba"
            >
              <Ionicons name="chevron-up" size={14} color={currentTheme.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              disabled={index === totalItems - 1}
              onPress={() => onMovePosition('down')}
              style={[styles.reorderBtn, { opacity: index === totalItems - 1 ? 0.25 : 1 }]}
              accessibilityLabel="Mover lote abajo"
            >
              <Ionicons name="chevron-down" size={14} color={currentTheme.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Checkbox de selección completa de inventario */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onToggleEntireSelection}
          style={styles.invCheckboxTouch}
        >
          <Ionicons
            name={
              isFullySelected
                ? 'checkbox'
                : isPartiallySelected
                  ? 'remove-circle'
                  : 'square-outline'
            }
            size={22}
            color={
              isFullySelected || isPartiallySelected
                ? currentTheme.primary
                : currentTheme.textSecondary
            }
          />
        </TouchableOpacity>

        {/* Título y badge interactivos para expandir/colapsar */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onToggleExpand}
          style={styles.invTitleArea}
        >
          <Ionicons
            name="folder-open"
            size={18}
            color={currentTheme.primary}
            style={{ marginRight: 8 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.inventoryTitle, { color: currentTheme.text }]} numberOfLines={1}>
              {inv.name}
            </Text>
            <Text style={[styles.inventoryMeta, { color: currentTheme.textSecondary }]}>
              {inv.boxes.length} caja{inv.boxes.length !== 1 ? 's' : ''} · {inv.totalGarments} prenda{inv.totalGarments !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Badge numérico de cajas seleccionadas */}
          <View style={[styles.countBadge, { backgroundColor: currentTheme.primary + '15' }]}>
            <Text style={[styles.countBadgeText, { color: currentTheme.primary }]}>
              {selectedCountInInv}/{inv.boxes.length}
            </Text>
          </View>

          {/* Chevron de expansión */}
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={currentTheme.textSecondary}
            style={{ marginLeft: 6 }}
          />
        </TouchableOpacity>
      </View>

      {/* Cajas hijas dentro del Inventario (Desplegable) */}
      {isExpanded && (
        <View style={[styles.boxesSubContainer, { borderTopColor: currentTheme.border }]}>
          {inv.boxes.map(box => {
            const isBoxSelected = selectedBoxKeys.includes(box.key);
            return (
              <TouchableOpacity
                key={box.key}
                activeOpacity={0.7}
                onPress={() => onToggleSingleBox(box.key)}
                style={[
                  styles.boxRow,
                  {
                    backgroundColor: isBoxSelected
                      ? currentTheme.primary + '12'
                      : currentTheme.card,
                    borderColor: isBoxSelected ? currentTheme.primary + '40' : currentTheme.border,
                  },
                ]}
              >
                <Ionicons
                  name={isBoxSelected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                  color={isBoxSelected ? currentTheme.primary : currentTheme.textSecondary}
                  style={{ marginRight: 8 }}
                />
                <Ionicons
                  name="cube-outline"
                  size={16}
                  color={currentTheme.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.boxRowText,
                    {
                      color: isBoxSelected ? currentTheme.primary : currentTheme.text,
                      fontWeight: isBoxSelected ? '700' : '500',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {box.name}
                </Text>

                <View style={[styles.prendaCountChip, { backgroundColor: currentTheme.border + '40' }]}>
                  <Text style={[styles.prendaCountText, { color: currentTheme.textSecondary }]}>
                    {box.garmentCount} p.
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  inventoryCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  inventoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  reorderBtnsColumn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 6,
    gap: 2,
  },
  reorderBtn: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invCheckboxTouch: {
    paddingRight: 8,
  },
  invTitleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inventoryTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  inventoryMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 4,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  boxesSubContainer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 6,
  },
  boxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  boxRowText: {
    flex: 1,
    fontSize: 13,
  },
  prendaCountChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  prendaCountText: {
    fontSize: 10,
    fontWeight: '600',
  },
});

export default ExportInventoryAccordion;
