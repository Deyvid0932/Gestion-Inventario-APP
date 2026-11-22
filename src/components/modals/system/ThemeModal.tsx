import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { SCHEME_COLORS, ColorSchemeType, clayStyles } from '../../../styles/theme';
import { useAppStore } from '../../../store/useAppStore';

interface ThemeModalProps {
  visible: boolean;
  onClose: () => void;
}

const THEME_OPTIONS: { key: ColorSchemeType; label: string; description: string }[] = [
  { key: 'morado', label: 'Morado Real', description: 'Tono elegante y violeta vibrante' },
  { key: 'dorado', label: 'Dorado Cálido', description: 'Tono ámbar cálido y prémium' },
  { key: 'celeste', label: 'Celeste Fresco', description: 'Tono azul claro y moderno' },
  { key: 'verde', label: 'Verde Esmeralda', description: 'Tono verde natural y fresco' },
  { key: 'rosado', label: 'Rosado Neón', description: 'Tono rosa vibrante y elegante' },
  { key: 'rojo', label: 'Rojo Pasión', description: 'Tono rojo intenso y dinámico' },
  { key: 'gris', label: 'Gris Grafito', description: 'Tono gris neutro y minimalista' },
  { key: 'marron', label: 'Marrón Café', description: 'Tono tierra cálido y clásico' },
];

export const ThemeModal: React.FC<ThemeModalProps> = ({ visible, onClose }) => {
  const db = useSQLiteContext();
  const currentTheme = useAppStore(state => state.currentTheme);
  const colorScheme = useAppStore(state => state.colorScheme);
  const setColorScheme = useAppStore(state => state.setColorScheme);
  const insets = useSafeAreaInsets();

  const handleSelectScheme = (schemeKey: ColorSchemeType) => {
    setColorScheme(schemeKey, db);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheetContainer,
            clayStyles,
            {
              backgroundColor: currentTheme.card,
              borderColor: currentTheme.border,
              shadowColor: currentTheme.borderShadow || '#000',
              paddingBottom: Math.max(insets.bottom + 20, 48),
            },
          ]}
        >
          <View style={styles.dragIndicator} />

          <View style={styles.headerRow}>
            <View style={styles.titleContainer}>
              <Ionicons name="color-palette" size={22} color={currentTheme.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.modalTitle, { color: currentTheme.text }]} allowFontScaling={true}>
                Paleta de Colores
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: currentTheme.border + '30' }]}
              accessibilityLabel="Cerrar selector de tema"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={20} color={currentTheme.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.staticBody}>
            <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary, marginBottom: 12 }]}>
              SELECCIONA UNA PALETA DE COLOR
            </Text>

            {THEME_OPTIONS.map((item) => {
              const isSelected = colorScheme === item.key;
              const colorHex = SCHEME_COLORS[item.key];

              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => handleSelectScheme(item.key)}
                  activeOpacity={0.7}
                  style={[
                    styles.schemeItem,
                    {
                      backgroundColor: isSelected ? currentTheme.primary + '15' : currentTheme.background,
                      borderColor: isSelected ? currentTheme.primary : currentTheme.border,
                    },
                  ]}
                >
                  <View style={styles.schemeLeft}>
                    <View style={[styles.colorSwatch, { backgroundColor: colorHex }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.schemeLabel, { color: currentTheme.text }]}>
                        {item.label}
                      </Text>
                      <Text style={[styles.schemeDesc, { color: currentTheme.textSecondary }]}>
                        {item.description}
                      </Text>
                    </View>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color={currentTheme.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    paddingTop: 100,
  },
  sheetContainer: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderWidth: 1,
    elevation: 10,
  },
  staticBody: {
    flex: 1,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  infoText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
  },
  dragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#CCCCCC',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  schemeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 6,
    minHeight: 44,
  },
  schemeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 12,
    elevation: 2,
  },
  schemeLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  schemeDesc: {
    fontSize: 12,
  },
});
