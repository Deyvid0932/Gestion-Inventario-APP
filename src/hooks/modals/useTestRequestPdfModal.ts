import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { Garment } from '../../types';
import {
  TestRequestFormData,
  createDefaultTestRequest,
  exportTestRequestToPdf,
} from '../../utils/testRequest';

interface UseTestRequestPdfModalProps {
  visible: boolean;
  selectedGarments: Garment[];
  onClose: () => void;
}

export const useTestRequestPdfModal = ({
  visible,
  selectedGarments,
  onClose,
}: UseTestRequestPdfModalProps) => {
  const [forms, setForms] = useState<TestRequestFormData[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (visible && selectedGarments.length > 0) {
      const initialForms = selectedGarments.map(g => createDefaultTestRequest(g));
      setForms(initialForms);
      setActiveIndex(0);
    }
  }, [visible, selectedGarments]);

  const currentForm = forms[activeIndex] || forms[0] || createDefaultTestRequest();

  const updateCurrentFormField = useCallback(<K extends keyof TestRequestFormData>(
    field: K,
    value: TestRequestFormData[K]
  ) => {
    setForms(prev => {
      const next = [...prev];
      if (next[activeIndex]) {
        next[activeIndex] = {
          ...next[activeIndex],
          [field]: value,
        };
      }
      return next;
    });
  }, [activeIndex]);

  const updateFormFieldAtIndex = useCallback(<K extends keyof TestRequestFormData>(
    index: number,
    field: K,
    value: TestRequestFormData[K]
  ) => {
    setForms(prev => {
      const next = [...prev];
      if (next[index]) {
        next[index] = {
          ...next[index],
          [field]: value,
        };
      }
      return next;
    });
  }, []);

  const toggleCheckbox = useCallback((field: keyof TestRequestFormData) => {
    setForms(prev => {
      const next = [...prev];
      if (next[activeIndex]) {
        const curVal = !!next[activeIndex][field];
        next[activeIndex] = {
          ...next[activeIndex],
          [field]: !curVal,
        };
      }
      return next;
    });
  }, [activeIndex]);

  const toggleCheckboxAtIndex = useCallback((index: number, field: keyof TestRequestFormData) => {
    setForms(prev => {
      const next = [...prev];
      if (next[index]) {
        const curVal = !!next[index][field];
        next[index] = {
          ...next[index],
          [field]: !curVal,
        };
      }
      return next;
    });
  }, []);

  const handleExport = useCallback(async () => {
    if (!forms || forms.length === 0) return;
    setGenerating(true);
    try {
      const firstStyle = forms[0]?.estilo ? `_${forms[0].estilo.replace(/[\/\s]/g, '_')}` : '';
      const fileName = `Solicitud_Ensayo${firstStyle}_2x1`;
      const success = await exportTestRequestToPdf(forms, fileName);
      if (success) {
        onClose();
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Error al generar el PDF');
    } finally {
      setGenerating(false);
    }
  }, [forms, onClose]);

  const totalPages = Math.ceil(forms.length / 2);
  const isOddOnLast = forms.length % 2 !== 0;

  return {
    forms,
    activeIndex,
    setActiveIndex,
    currentForm,
    generating,
    totalPages,
    isOddOnLast,
    updateCurrentFormField,
    updateFormFieldAtIndex,
    toggleCheckbox,
    toggleCheckboxAtIndex,
    handleExport,
  };
};
