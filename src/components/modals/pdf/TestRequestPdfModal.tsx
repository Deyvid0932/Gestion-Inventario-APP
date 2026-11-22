import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Keyboard,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Garment } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import { useTestRequestPdfModal } from '../../../hooks';
import { InteractivePdfPageCanvas } from './InteractivePdfPageCanvas';
import { TestRequestFormData } from '../../../utils/testRequest';

interface TestRequestPdfModalProps {
  visible: boolean;
  onClose: () => void;
  selectedGarments: Garment[];
}

export const TestRequestPdfModal: React.FC<TestRequestPdfModalProps> = (props) => {
  if (!props.visible) return null;
  return <TestRequestPdfModalContent {...props} />;
};

const TestRequestPdfModalContent: React.FC<TestRequestPdfModalProps> = ({
  visible,
  onClose,
  selectedGarments,
}) => {
  const insets = useSafeAreaInsets();
  const currentTheme = useAppStore((state) => state.currentTheme);

  const {
    forms,
    generating,
    updateFormFieldAtIndex,
    toggleCheckboxAtIndex,
    handleExport,
  } = useTestRequestPdfModal({ visible, selectedGarments, onClose });

  // Paginación: 1 solicitud a la vez
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);

  // Estado del campo actualmente en edición directa sobre el PDF
  const [editingFieldKey, setEditingFieldKey] =
    useState<keyof TestRequestFormData | null>(null);
  const [editingPageIndex, setEditingPageIndex] = useState<number>(0);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      setCurrentPageIndex(0);
      setEditingFieldKey(null);
    }
  }, [visible]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates?.height || 280);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleSelectField = useCallback(
    (fieldKey: keyof TestRequestFormData, pageIndex: number, yOffsetPx?: number) => {
      setEditingFieldKey(fieldKey);
      setEditingPageIndex(pageIndex);
      setCurrentPageIndex(pageIndex);
      if (typeof yOffsetPx === 'number') {
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            y: Math.max(0, yOffsetPx - 110),
            animated: true,
          });
        }, 120);
      }
    },
    []
  );

  const handleChangeField = useCallback(
    (fieldKey: keyof TestRequestFormData, pageIndex: number, value: string) => {
      updateFormFieldAtIndex(pageIndex, fieldKey, value);
    },
    [updateFormFieldAtIndex]
  );

  const handleBlurField = useCallback(() => {
    setEditingFieldKey(null);
  }, []);

  const handleToggleCheckbox = useCallback(
    (fieldKey: keyof TestRequestFormData, pageIndex: number) => {
      Keyboard.dismiss();
      setEditingFieldKey(null);
      toggleCheckboxAtIndex(pageIndex, fieldKey);
    },
    [toggleCheckboxAtIndex]
  );

  const totalSheets2x1 = Math.ceil(forms.length / 2);
  const isOdd = forms.length % 2 !== 0;

  if (!visible || forms.length === 0) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.overlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: currentTheme.card || '#FFFFFF',
                paddingTop: Math.max(insets.top, 10),
                paddingBottom: Math.max(insets.bottom, 10),
              },
            ]}
          >
            {/* Barra superior del modal */}
            <View
              style={[
                styles.headerRow,
                { borderBottomColor: currentTheme.border || '#E2E8F0' },
              ]}
            >
              <View style={styles.headerTitleWrap}>
                <View
                  style={[
                    styles.headerIconWrap,
                    { backgroundColor: '#E11D4818' },
                  ]}
                >
                  <Ionicons name="document-text" size={20} color="#E11D48" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.modalTitle,
                      { color: currentTheme.text || '#0F172A' },
                    ]}
                    numberOfLines={1}
                  >
                    Solicitud de Ensayo
                  </Text>
                  <Text
                    style={[
                      styles.modalSubtitle,
                      { color: currentTheme.textSecondary || '#64748B' },
                    ]}
                    numberOfLines={1}
                  >
                    {forms.length === 1
                      ? '1 solicitud • Toca sobre la raya para editar'
                      : `Solicitud ${currentPageIndex + 1} de ${forms.length} • Toca para editar`}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={onClose}
                style={[
                  styles.closeBtn,
                  { backgroundColor: (currentTheme.border || '#E2E8F0') + '40' },
                ]}
                accessibilityLabel="Cerrar"
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={currentTheme.text || '#0F172A'}
                />
              </TouchableOpacity>
            </View>

            {/* Barra de paginación (solo cuando hay más de 1 solicitud) */}
            {forms.length > 1 && (
              <View
                style={[
                  styles.paginationBar,
                  {
                    backgroundColor: currentTheme.background || '#F8FAFC',
                    borderBottomColor: currentTheme.border || '#E2E8F0',
                  },
                ]}
              >
                <TouchableOpacity
                  onPress={() => setCurrentPageIndex((p) => Math.max(0, p - 1))}
                  disabled={currentPageIndex === 0}
                  style={[
                    styles.pageNavBtn,
                    currentPageIndex === 0 && styles.pageNavBtnDisabled,
                  ]}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="chevron-back"
                    size={18}
                    color={currentPageIndex === 0 ? '#94A3B8' : '#2563EB'}
                  />
                  <Text
                    style={[
                      styles.pageNavText,
                      currentPageIndex === 0 && styles.pageNavTextDisabled,
                    ]}
                  >
                    Anterior
                  </Text>
                </TouchableOpacity>

                <View style={styles.pageIndicatorWrap}>
                  <Text
                    style={[
                      styles.pageIndicatorText,
                      { color: currentTheme.text || '#0F172A' },
                    ]}
                  >
                    Solicitud {currentPageIndex + 1} de {forms.length}
                  </Text>
                  <Text
                    style={[
                      styles.pageIndicatorSub,
                      { color: currentTheme.textSecondary || '#64748B' },
                    ]}
                    numberOfLines={1}
                  >
                    {forms[currentPageIndex]?.estilo ||
                      forms[currentPageIndex]?.color ||
                      'Prenda'}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() =>
                    setCurrentPageIndex((p) => Math.min(forms.length - 1, p + 1))
                  }
                  disabled={currentPageIndex === forms.length - 1}
                  style={[
                    styles.pageNavBtn,
                    currentPageIndex === forms.length - 1 && styles.pageNavBtnDisabled,
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.pageNavText,
                      currentPageIndex === forms.length - 1 && styles.pageNavTextDisabled,
                    ]}
                  >
                    Siguiente
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={
                      currentPageIndex === forms.length - 1 ? '#94A3B8' : '#2563EB'
                    }
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* Lienzo de la solicitud actual (1 carilla a la vez) */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.pageScroll}
              contentContainerStyle={[
                styles.singlePageContent,
                { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 80 : 24 },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <InteractivePdfPageCanvas
                form={forms[currentPageIndex]}
                pageIndex={currentPageIndex}
                totalCount={forms.length}
                activeFieldKey={editingFieldKey}
                activePageIndex={editingPageIndex}
                onSelectField={handleSelectField}
                onChangeField={handleChangeField}
                onBlurField={handleBlurField}
                onToggleCheckbox={handleToggleCheckbox}
              />
            </ScrollView>

            {/* Barra inferior de exportación / compartir (oculta mientras el teclado está abierto) */}
            {keyboardHeight === 0 && (
              <View
                style={[
                  styles.footerBar,
                  { borderTopColor: currentTheme.border || '#E2E8F0' },
                ]}
              >
              <TouchableOpacity
                style={[
                  styles.exportBtn,
                  { backgroundColor: '#E11D48', opacity: generating ? 0.75 : 1 },
                ]}
                onPress={handleExport}
                disabled={generating}
                activeOpacity={0.85}
              >
                {generating ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFF"
                    style={{ marginRight: 8 }}
                  />
                ) : (
                  <Ionicons
                    name="share-social-outline"
                    size={19}
                    color="#FFF"
                    style={{ marginRight: 8 }}
                  />
                )}
                <Text style={styles.exportBtnText}>
                  {generating
                    ? 'Generando PDF'
                    : `Compartir PDF (${totalSheets2x1} hoja${totalSheets2x1 > 1 ? 's' : ''
                    })`}
                </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  modalCard: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 15.5,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  pageNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  pageNavBtnDisabled: {
    backgroundColor: 'transparent',
  },
  pageNavText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  pageNavTextDisabled: {
    color: '#94A3B8',
  },
  pageIndicatorWrap: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  pageIndicatorText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  pageIndicatorSub: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  pageScroll: {
    flex: 1,
  },
  singlePageContent: {
    paddingBottom: 20,
  },
  editDock: {
    borderTopWidth: 2,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 6,
  },
  editDockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dockTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  dockPageBadge: {
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dockFieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1,
  },
  dockNavButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dockNavBtn: {
    backgroundColor: '#F1F5F9',
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockDoneBtn: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
  },
  dockDoneText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  dockInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13.5,
    fontWeight: '600',
  },
  footerBar: {
    paddingHorizontal: 14,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  exportBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
  },
});
