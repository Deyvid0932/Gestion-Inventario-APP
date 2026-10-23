import { useState, useRef, useEffect, useCallback } from 'react';
import { Alert, FlatList } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useAppStore } from '../../store/useAppStore';
import { ChatbotService, ChatMessage } from '../../services';
import { VoiceService } from '../../services';
import { RootStackParamList, ChatSession } from '../../types';
import { SyncScheduler } from '../../sync/SyncScheduler';
import { SynchronizationEngine } from '../../sync/SynchronizationEngine';
import { useRoles } from '../common/useRoles';
import { SearchResult } from '../../utils/nlpEngine';

const WELCOME_MESSAGE: ChatMessage = {
  id: '1',
  sender: 'bot',
  text: '¡Hola! 👋 Soy Topytop IA, copiloto operativo de Garment Manager. Puedo guiarte sobre el uso de la app y taller, o darte resúmenes del inventario. ¿En qué te ayudo hoy?',
  timestamp: Date.now(),
};

export const useChatbotScreen = () => {
  const db = useSQLiteContext();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const currentTheme = useAppStore(state => state.currentTheme);
  const themeMode = useAppStore(state => state.themeMode);
  const user = useAppStore(state => state.user);
  const { hasRole } = useRoles();

  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeModel, setActiveModel] = useState<string>('Detectando modelo...');

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const lastNavTime = useRef(0);

  // Ref para rastrear si ya hicimos la carga inicial + sync
  const hasInitialized = useRef(false);
  // Ref para evitar re-cargar mensajes cuando nosotros mismos cambiamos el sessionId
  const skipNextLoadRef = useRef(false);
  // Ref del sessionId actual para evitar closures stale
  const currentSessionIdRef = useRef<string | null>(null);
  currentSessionIdRef.current = currentSessionId;

  /** Carga mensajes de SQLite para una sesión dada */
  const loadMessagesForSession = useCallback(async (sessionId: string) => {
    try {
      const history = await ChatbotService.getHistoryBySession(db, sessionId);
      if (history.length > 0) {
        setMessages(history);
      } else {
        setMessages([{ ...WELCOME_MESSAGE, timestamp: Date.now() }]);
      }
    } catch (e) {
      console.error('[useChatbotScreen] Error cargando historial:', e);
    }
  }, [db]);

  /** Carga sesiones de SQLite y selecciona la activa */
  const loadLocalSessions = useCallback(async (): Promise<string | null> => {
    const allSessions = await ChatbotService.getSessions(db, user?.id);
    setSessions(allSessions);

    if (allSessions.length > 0) {
      const current = currentSessionIdRef.current;
      const activeId = (current && allSessions.some(s => s.id === current))
        ? current
        : allSessions[0].id;
      return activeId;
    }
    return null;
  }, [db, user?.id]);

  // Cleanup
  useEffect(() => {
    return () => {
      VoiceService.stopRecording();
    };
  }, []);

  // ========== CARGA INICIAL (solo una vez al montar) ==========
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    let cancelled = false;

    const init = async () => {
      // 0. Limpieza única de sesiones soft-deleted y adopción de huérfanas
      await ChatbotService.cleanupSoftDeleted(db);
      if (user?.id) {
        await ChatbotService.adoptOrphanSessions(db, user.id);
      }

      // 1. Cargar sesiones locales inmediatamente
      const allSessions = await ChatbotService.getSessions(db, user?.id);
      if (cancelled) return;
      setSessions(allSessions);

      let activeId: string | null = null;

      if (allSessions.length > 0) {
        activeId = allSessions[0].id;
      } else {
        // No hay sesiones, crear una nueva
        activeId = await ChatbotService.createSession(db, 'Nueva conversación', user?.id);
        if (cancelled) return;
        const refreshed = await ChatbotService.getSessions(db, user?.id);
        if (cancelled) return;
        setSessions(refreshed);
      }

      if (activeId) {
        skipNextLoadRef.current = true;
        setCurrentSessionId(activeId);
        await loadMessagesForSession(activeId);
      }

      // 2. Si hay usuario autenticado, sincronizar en background silenciosamente (sin bloquear con LoadingModal)
      if (user?.id) {
        try {
          await SynchronizationEngine.fullSync(db, user.id, true);
          if (cancelled) return;

          // Refrescar sesiones después del sync
          const syncedSessions = await ChatbotService.getSessions(db, user.id);
          if (cancelled) return;
          setSessions(syncedSessions);

          // Si la sesión activa sigue existiendo, recargar sus mensajes
          const currentId = currentSessionIdRef.current;
          if (currentId && syncedSessions.some(s => s.id === currentId)) {
            await loadMessagesForSession(currentId);
          } else if (syncedSessions.length > 0) {
            // La sesión activa ya no existe, usar la primera
            const newActiveId = syncedSessions[0].id;
            skipNextLoadRef.current = true;
            setCurrentSessionId(newActiveId);
            await loadMessagesForSession(newActiveId);
          }
        } catch (syncErr) {
          console.warn('[useChatbotScreen] Error en sync inicial:', syncErr);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [db, user?.id, loadMessagesForSession, loadLocalSessions]);

  // ========== CUANDO CAMBIA currentSessionId (por selección del usuario) ==========
  useEffect(() => {
    if (!currentSessionId) return;
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      return;
    }
    loadMessagesForSession(currentSessionId);
  }, [currentSessionId, loadMessagesForSession]);

  // Detectar modelo activo
  useEffect(() => {
    let isMounted = true;
    const fetchActiveModel = async () => {
      try {
        const model = await ChatbotService.getActiveModelName(db);
        if (isMounted && model) {
          setActiveModel(model);
        }
      } catch (_) {}
    };
    fetchActiveModel();
    return () => {
      isMounted = false;
    };
  }, [db]);

  // Scroll al último mensaje
  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [messages]);

  const handleSend = async (textToSend?: string) => {
    if (!currentSessionId) return;
    const userText = typeof textToSend === 'string' ? textToSend : input;
    if (!userText.trim() || isTyping) return;

    const shouldUpdateTitle = messages.length <= 1;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      timestamp: Date.now(),
    };

    setMessages(prev => [userMsg, ...prev]);
    setInput('');
    setIsTyping(true);

    try {
      await ChatbotService.saveMessage(db, userMsg, currentSessionId);
      const response = await ChatbotService.searchAndRespond(db, userText, currentSessionId);
      if (response.modelName) {
        setActiveModel(response.modelName);
      }
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: response.text,
        matches: response.matches,
        boxMatch: response.boxMatch,
        engineUsed: response.engineUsed,
        modelName: response.modelName,
        timestamp: Date.now(),
      };

      setMessages(prev => [botMsg, ...prev]);
      await ChatbotService.saveMessage(db, botMsg, currentSessionId);

      if (shouldUpdateTitle) {
        void ChatbotService.updateSessionTitle(db, currentSessionId, userText.substring(0, 30))
          .then(() => ChatbotService.getSessions(db, user?.id))
          .then(setSessions)
          .catch(error => console.warn('[Chatbot] No se pudo actualizar el título:', error));
      }

      if (user?.id) {
        SyncScheduler.schedulePush(db, user.id);
      }
    } catch (error) {
      console.error('Error procesando respuesta del bot:', error);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: 'Ocurrió un error al procesar tu consulta. Intenta nuevamente.',
        timestamp: Date.now(),
      };
      setMessages(prev => [errorMsg, ...prev]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleVoiceToggle = async () => {
    if (isRecording) {
      setIsRecording(false);
      setIsTranscribing(true);
      try {
        const transcribedText = await VoiceService.stopRecordingAndTranscribe();
        if (transcribedText && transcribedText.trim() !== '') {
          setInput(transcribedText);
          handleSend(transcribedText);
        } else {
          Alert.alert('Voz no detectada', 'No se pudo reconocer audio claro. Intenta de nuevo.');
        }
      } catch (err: any) {
        console.error('Error en transcripción:', err);
        Alert.alert('Error', 'Hubo un error al procesar la voz.');
      } finally {
        setIsTranscribing(false);
      }
    } else {
      const started = await VoiceService.startRecording();
      if (started) {
        setIsRecording(true);
      } else {
        Alert.alert('Permiso Denegado', 'Por favor habilita el micrófono en los ajustes de tu teléfono.');
      }
    }
  };

  const handleNewSession = async () => {
    const newSessionId = await ChatbotService.createSession(db, 'Nueva conversación', user?.id);
    skipNextLoadRef.current = true;
    setCurrentSessionId(newSessionId);
    setMessages([{ ...WELCOME_MESSAGE, timestamp: Date.now() }]);
    setSessions(await ChatbotService.getSessions(db, user?.id));
    setIsSidebarOpen(false);
    if (user?.id) {
      SyncScheduler.schedulePush(db, user.id);
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    Alert.alert(
      '¿Eliminar conversación?',
      'Se borrará el historial de este chat.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await ChatbotService.deleteSession(db, sessionId, user?.id);
            const updatedSessions = await ChatbotService.getSessions(db, user?.id);
            setSessions(updatedSessions);

            if (currentSessionIdRef.current === sessionId) {
              if (updatedSessions.length > 0) {
                const nextId = updatedSessions[0].id;
                skipNextLoadRef.current = true;
                setCurrentSessionId(nextId);
                await loadMessagesForSession(nextId);
              } else {
                const newId = await ChatbotService.createSession(db, 'Nueva conversación', user?.id);
                skipNextLoadRef.current = true;
                setCurrentSessionId(newId);
                setSessions(await ChatbotService.getSessions(db, user?.id));
                setMessages([{ ...WELCOME_MESSAGE, timestamp: Date.now() }]);
              }
            }
          },
        },
      ]
    );
  };

  const handleSelectSession = async (sessionId: string) => {
    if (sessionId === currentSessionIdRef.current) {
      // Ya estamos en esta sesión, solo cerrar sidebar
      setIsSidebarOpen(false);
      return;
    }
    setIsSidebarOpen(false);
    skipNextLoadRef.current = true;
    setCurrentSessionId(sessionId);
    await loadMessagesForSession(sessionId);
  };

  const handleResultItemPress = async (match: SearchResult) => {
    let targetBoxId = match.box_id;
    let targetBoxName = match.box_name;
    if ((!targetBoxId || targetBoxId === '') && match.id && db) {
      try {
        const garment = await db.getFirstAsync<{ box_id: string; box_name: string }>(
          'SELECT g.box_id, b.name as box_name FROM garments g JOIN boxes b ON g.box_id = b.id WHERE g.id = ?',
          [match.id]
        );
        if (garment) {
          targetBoxId = garment.box_id;
          targetBoxName = garment.box_name;
        }
      } catch (e) {
        console.error('Error fetching box_id for match:', e);
      }
    }
    if (!targetBoxId) {
      Alert.alert('Aviso', 'No se encontró la caja asociada a esta prenda.');
      return;
    }
    const rootNav = (navigation.getParent() as any) || navigation;
    rootNav.navigate('BoxContents', { boxId: targetBoxId, boxName: targetBoxName || 'Caja', targetGarmentId: match.id });
  };

  const handleBoxPress = (boxId: string, boxName: string) => {
    const rootNav = (navigation.getParent() as any) || navigation;
    rootNav.navigate('BoxContents', { boxId, boxName: boxName || 'Caja' });
  };

  return {
    state: {
      messages,
      sessions,
      currentSessionId,
      isSidebarOpen,
      activeModel,
      input,
      isTyping,
      isRecording,
      isTranscribing,
    },
    computed: {
      currentTheme,
      themeMode,
      hasRole,
    },
    refs: {
      flatListRef,
    },
    handlers: {
      setInput,
      setIsSidebarOpen,
      handleSend,
      handleVoiceToggle,
      handleNewSession,
      handleDeleteSession,
      handleSelectSession,
      handleResultItemPress,
      handleBoxPress,
    },
  };
};
