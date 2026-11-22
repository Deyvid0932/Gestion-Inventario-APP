import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {
  PDF_HALF_WIDTH,
  PDF_HALF_HEIGHT,
  PDF_TEXT_FIELDS,
  PDF_CHECKBOX_FIELDS,
} from '../../../utils/testRequest/pdfCoordinates';
import { TestRequestFormData } from '../../../utils/testRequest';

interface InteractivePdfPageCanvasProps {
  form: TestRequestFormData;
  pageIndex: number;
  totalCount: number;
  activeFieldKey: keyof TestRequestFormData | null;
  activePageIndex: number;
  onSelectField: (fieldKey: keyof TestRequestFormData, pageIndex: number, yOffsetPx?: number) => void;
  onChangeField: (fieldKey: keyof TestRequestFormData, pageIndex: number, value: string) => void;
  onBlurField: () => void;
  onToggleCheckbox: (fieldKey: keyof TestRequestFormData, pageIndex: number) => void;
}

export const InteractivePdfPageCanvas: React.FC<InteractivePdfPageCanvasProps> = React.memo(({
  form,
  pageIndex,
  totalCount,
  activeFieldKey,
  activePageIndex,
  onSelectField,
  onChangeField,
  onBlurField,
  onToggleCheckbox,
}) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const renderWidth = containerWidth > 0 ? containerWidth : 350;
  const scale = renderWidth / PDF_HALF_WIDTH;
  const renderHeight = PDF_HALF_HEIGHT * scale;

  // Valores animados para pellizcar (agrandar/achicar) y arrastrar
  const zoomScale = useSharedValue(1);
  const savedZoomScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const clampTranslations = (tx: number, ty: number, s: number) => {
    'worklet';
    const maxTx = Math.max(0, ((s - 1) * renderWidth) / 2);
    const maxTy = Math.max(0, ((s - 1) * renderHeight) / 2);
    return {
      x: Math.min(maxTx, Math.max(-maxTx, tx)),
      y: Math.min(maxTy, Math.max(-maxTy, ty)),
    };
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const next = Math.min(3.5, Math.max(1, savedZoomScale.value * e.scale));
      zoomScale.value = next;
      const clamped = clampTranslations(translateX.value, translateY.value, next);
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    })
    .onEnd(() => {
      if (zoomScale.value <= 1.05) {
        zoomScale.value = withTiming(1);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedZoomScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(setIsZoomed)(false);
      } else {
        savedZoomScale.value = zoomScale.value;
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
        runOnJS(setIsZoomed)(true);
      }
    });

  const panGesture = Gesture.Pan()
    .enabled(isZoomed)
    .activeOffsetX([-8, 8])
    .activeOffsetY([-8, 8])
    .onUpdate((e) => {
      const clamped = clampTranslations(
        savedTranslateX.value + e.translationX,
        savedTranslateY.value + e.translationY,
        zoomScale.value
      );
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (zoomScale.value > 1.05) {
        zoomScale.value = withTiming(1);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedZoomScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(setIsZoomed)(false);
      } else {
        zoomScale.value = withTiming(2);
        savedZoomScale.value = 2;
        runOnJS(setIsZoomed)(true);
      }
    });

  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    doubleTapGesture
  );

  const animatedCanvasStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: zoomScale.value },
    ],
  }));

  return (
    <View
      style={styles.pageCard}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - containerWidth) > 2) {
          setContainerWidth(w);
        }
      }}
    >
      {/* Barra superior de la página */}
      <View style={styles.pageHeaderRow}>
        <View style={styles.pageBadge}>
          <Text style={styles.pageBadgeText}>
            SOLICITUD {pageIndex + 1} DE {totalCount}
          </Text>
        </View>

        <Text style={styles.pageSubtitle} numberOfLines={1}>
          {form.estilo || 'Prenda'} {form.color ? `• ${form.color}` : ''}
        </Text>
      </View>

      {/* Contenedor del lienzo con pellizco libre para agrandar y achicar */}
      <View style={styles.zoomViewport}>
        <GestureDetector gesture={composedGesture}>
          <Animated.View
            style={[
              styles.canvasContainer,
              {
                width: renderWidth,
                height: renderHeight,
              },
              animatedCanvasStyle,
            ]}
          >
            {/* 1. Imagen maestra 300 DPI del PDF original oficial */}
            <Image
              source={require('../../../../assets/solicitud_ensayo_half.png')}
              style={styles.masterPdfImage}
              resizeMode="contain"
            />

            {/* 2. Superposición de Textos editables */}
            {PDF_TEXT_FIELDS.map((f) => {
              const val = String(form[f.key] || '');
              const isActive = activeFieldKey === f.key && activePageIndex === pageIndex;
              const isMultiline = f.key === 'comentarios';
              const fieldFontSize = Math.max(f.fontSize * scale, 6.5);
              const textColor = f.key === 'solicitudNumero' ? '#DC2626' : '#0F172A';

              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => onSelectField(f.key, pageIndex, f.top * scale)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 5, bottom: 5, left: 2, right: 2 }}
                  style={[
                    styles.fieldTouchable,
                    {
                      left: f.x * scale,
                      top: f.top * scale,
                      width: f.width * scale,
                      height: f.height * scale,
                      justifyContent: isMultiline ? 'flex-start' : 'flex-end',
                      paddingTop: isMultiline ? 2 * scale : 0,
                      backgroundColor: isActive
                        ? 'rgba(37, 99, 235, 0.14)'
                        : !val
                          ? 'rgba(37, 99, 235, 0.04)'
                          : 'transparent',
                      borderWidth: isActive ? 1 : 0,
                      borderColor: isActive ? '#2563EB' : 'transparent',
                      borderRadius: 2,
                    },
                  ]}
                >
                  {isActive && (
                    <View style={styles.activeFieldBadge} pointerEvents="none">
                      <Text style={styles.activeFieldBadgeText} numberOfLines={1} allowFontScaling={false}>
                        {f.label}
                      </Text>
                    </View>
                  )}
                  {isActive ? (
                    <TextInput
                      autoFocus={true}
                      value={val}
                      onChangeText={(text) => onChangeField(f.key, pageIndex, text)}
                      onBlur={onBlurField}
                      multiline={isMultiline}
                      returnKeyType="done"
                      blurOnSubmit={true}
                      underlineColorAndroid="transparent"
                      allowFontScaling={false}
                      style={[
                        styles.inlineInput,
                        {
                          fontSize: fieldFontSize,
                          textAlign: f.align || 'left',
                          textAlignVertical: isMultiline ? 'top' : 'bottom',
                          lineHeight: isMultiline ? 12.4 * scale : undefined,
                          color: textColor,
                        },
                      ]}
                    />
                  ) : (
                    <Text
                      numberOfLines={isMultiline ? 2 : 1}
                      adjustsFontSizeToFit={!isMultiline}
                      minimumFontScale={0.7}
                      allowFontScaling={false}
                      style={[
                        styles.canvasText,
                        {
                          fontSize: fieldFontSize,
                          textAlign: f.align || 'left',
                          lineHeight: isMultiline ? 12.4 * scale : undefined,
                          color: textColor,
                          fontWeight: '700',
                        },
                      ]}
                    >
                      {val}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}

            {/* 3. Superposición de Checkboxes con X roja simple */}
            {PDF_CHECKBOX_FIELDS.map((chk) => {
              const checked = !!form[chk.key];

              return (
                <TouchableOpacity
                  key={chk.key}
                  onPress={() => onToggleCheckbox(chk.key, pageIndex)}
                  activeOpacity={0.6}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={[
                    styles.checkboxTouchable,
                    {
                      left: chk.x * scale,
                      top: chk.top * scale,
                      width: chk.width * scale,
                      height: chk.height * scale,
                    },
                  ]}
                >
                  {checked ? (
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.checkMarkX,
                        {
                          fontSize: Math.max(9.5 * scale, 8),
                        },
                      ]}
                    >
                      X
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  pageCard: {
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pageBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pageBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.5,
  },
  pageSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    marginLeft: 8,
  },
  zoomViewport: {
    overflow: 'hidden',
    alignItems: 'center',
  },
  canvasContainer: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },
  masterPdfImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  fieldTouchable: {
    position: 'absolute',
    justifyContent: 'flex-end',
    paddingHorizontal: 2,
    paddingBottom: 1,
    overflow: 'visible',
  },
  activeFieldBadge: {
    position: 'absolute',
    top: -15,
    left: 0,
    backgroundColor: '#2563EB',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    zIndex: 20,
  },
  activeFieldBadgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '800',
  },
  canvasText: {
    fontWeight: '700',
  },
  inlineInput: {
    width: '100%',
    height: '100%',
    padding: 0,
    margin: 0,
    fontWeight: '700',
    includeFontPadding: false,
    textAlignVertical: 'bottom',
  },
  checkboxTouchable: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMarkX: {
    color: '#DC2626',
    fontWeight: '900',
    textAlign: 'center',
    includeFontPadding: false,
  },
});
