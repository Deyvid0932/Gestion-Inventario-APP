import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { clayStyles } from '../style/theme';
import { useSQLiteContext } from 'expo-sqlite';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Animated, { FadeIn, FadeInRight, FadeInLeft, SlideInLeft, SlideOutLeft, FadeOut } from 'react-native-reanimated';
import { useAppStore } from '../store/useAppStore';
import { ChatbotService } from '../services/ChatbotService';
import { VoiceService } from '../services/VoiceService';
import { AccountModal } from '../components/AccountModal';
import { Image } from 'expo-image';
import { SearchResult } from '../utils/nlpEngine';
import { RootStackParamList, ChatSession } from '../types';

import { SynchronizationEngine } from '../sync/SynchronizationEngine';

const llamaLogo = require('../../assets/llama_logo.png');

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  matches?: SearchResult[];
  engineUsed?: 'ia' | 'local';
  timestamp: number;
}

export const ChatbotScreen = () => {
  const db = useSQLiteContext();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const currentTheme = useAppStore(state => state.currentTheme);
  const themeMode = useAppStore(state => state.themeMode);
  const user = useAppStore(state => state.user);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const lastNavTime = useRef(0);

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;

  useEffect(() => {
    return () => {
      VoiceService.stopRecording();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const loadSessions = async () => {
        const allSessions = await ChatbotService.getSessions(db, user?.id);
        if (!isMounted) return;
        setSessions(allSessions);

        if (allSessions.length > 0) {
          setCurrentSessionId(prev => {
            if (prev && allSessions.some(s => s.id === prev)) return prev;
            return allSessions[0].id;
          });
        } else {
          const newSessionId = await ChatbotService.createSession(db, 'Nueva conversación', user?.id);
          if (!isMounted) return;
          setCurrentSessionId(newSessionId);
          setSessions(await ChatbotService.getSessions(db, user?.id));
        }
      };

      loadSessions();
      return () => {
        isMounted = false;
      };
    }, [db, user?.id])
  );

  useEffect(() => {
    const loadHistory = async () => {
      if (!currentSessionId) return;
      const history = await ChatbotService.getHistoryBySession(db, currentSessionId);
      if (history.length > 0) {
        setMessages(history);
      } else {
        setMessages([{
          id: '1',
          sender: 'bot',
          text: '¡Hola! 👋 Soy tu asistente de inventario Topytop Kith. Puedes buscar por estilo, OP o color o hacer preguntas generales. ¿Qué necesitas?',
          timestamp: Date.now(),
        }]);
      }
    };
    loadHistory();
  }, [db, currentSessionId]);

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [messages]);

  const navigateSafe = useCallback((routeName: keyof RootStackParamList, params?: any) => {
    const now = Date.now();
    if (now - lastNavTime.current < 400) return;
    lastNavTime.current = now;
    navigation.navigate(routeName as any, params);
  }, [navigation]);

  const handleSend = async () => {
    const userText = input.trim();
    if (!userText || !currentSessionId) return;

    if (messages.length <= 1) {
      await ChatbotService.updateSessionTitle(db, currentSessionId, userText.substring(0, 30));
      setSessions(await ChatbotService.getSessions(db, user?.id));
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      timestamp: Date.now(),
    };

    setMessages(prev => [userMsg, ...prev]);
    setInput('');
    setIsTyping(true);

    await ChatbotService.saveMessage(db, userMsg, currentSessionId);

    try {
      const response = await ChatbotService.searchAndRespond(db, userText, currentSessionId);
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: response.text,
        matches: response.matches,
        engineUsed: response.engineUsed,
        timestamp: Date.now(),
      };

      setMessages(prev => [botMsg, ...prev]);
      await ChatbotService.saveMessage(db, botMsg, currentSessionId);

      if (user?.id) {
        SynchronizationEngine.pushAllPending(db, user.id).catch((e) => console.error('🔴 SYNC PUSH ERROR:', e));
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
      const text = await VoiceService.stopRecordingAndTranscribe();
      setIsTranscribing(false);
      if (text && text.trim()) {
        setInput(text.trim());
      }
    } else {
      const started = await VoiceService.startRecording();
      if (started) {
        setIsRecording(true);
      }
    }
  };

  const handleNewSession = async () => {
    const newSessionId = await ChatbotService.createSession(db, 'Nueva conversación', user?.id);
    setCurrentSessionId(newSessionId);
    setSessions(await ChatbotService.getSessions(db, user?.id));
    setIsSidebarOpen(false);
    if (user?.id) {
      SynchronizationEngine.pushAllPending(db, user.id).catch((e) => console.error('🔴 SYNC PUSH ERROR:', e));
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

            if (currentSessionId === sessionId) {
              if (updatedSessions.length > 0) {
                setCurrentSessionId(updatedSessions[0].id);
              } else {
                const newId = await ChatbotService.createSession(db, 'Nueva conversación', user?.id);
                setCurrentSessionId(newId);
                setSessions(await ChatbotService.getSessions(db, user?.id));
              }
            }
          },
        },
      ]
    );
  };

  const renderResultCard = (match: SearchResult) => (
    <Animated.View
      key={match.id}
      entering={FadeIn.duration(300)}
      style={[
        styles.resultCard,
        clayStyles,
        {
          backgroundColor: currentTheme.card,
          borderColor: currentTheme.border,
          shadowColor: currentTheme.borderShadow || '#000',
        },
      ]}
    >
      <View style={styles.cardRow}>
        <Ionicons name="shirt-outline" size={18} color={currentTheme.primary} style={{ marginRight: 6 }} />
        <Text style={[styles.cardTitle, { color: currentTheme.text }]} numberOfLines={1}>
          {match.estilo} - {match.color}
        </Text>
      </View>

      <Text style={[styles.cardSubtitle, { color: currentTheme.textSecondary }]}>
        OP: {match.op || 'Sin OP'} | Estado: {match.estado === 1 ? 'Escaneado' : 'Pendiente'}
      </Text>

      {match.cajaNombre && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Ionicons name="cube-outline" size={14} color={currentTheme.textSecondary} style={{ marginRight: 4 }} />
          <Text style={[styles.cardLocation, { color: currentTheme.textSecondary }]}>
            Ubicación: {match.inventarioNombre} → {match.cajaNombre}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.redirectBtn, { backgroundColor: currentTheme.primary + '20' }]}
        onPress={async () => {
          let targetCajaId = match.cajaId;
          let targetCajaNombre = match.cajaNombre;
          if ((!targetCajaId || targetCajaId === '') && match.id && db) {
            try {
              const prenda = await db.getFirstAsync<{ cajaId: string; cajaNombre: string }>(
                'SELECT p.cajaId, c.nombre as cajaNombre FROM prendas p JOIN cajas c ON p.cajaId = c.id WHERE p.id = ?',
                [match.id]
              );
              if (prenda) {
                targetCajaId = prenda.cajaId;
                targetCajaNombre = prenda.cajaNombre;
              }
            } catch (e) {
              console.error('Error fetching cajaId for match:', e);
            }
          }
          if (!targetCajaId) {
            Alert.alert('Aviso', 'No se encontró la caja asociada a esta prenda.');
            return;
          }
          const rootNav = (navigation.getParent() as any) || navigation;
          rootNav.navigate('ExcelGrid', { cajaId: targetCajaId, nombreCaja: targetCajaNombre || 'Caja', targetPrendaId: match.id });
        }}
      >
        <Ionicons name="link" size={14} color={currentTheme.primary} />
        <Text style={[styles.redirectBtnText, { color: currentTheme.primary }]}>Ir a la prenda</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: currentTheme.background }]}
    >
      {/* NAVBAR CON FOTO DE PERFIL DE USUARIO */}
      <View style={[styles.navbar, { backgroundColor: currentTheme.card, borderBottomColor: currentTheme.border }]}>
        <StatusBar
          barStyle={themeMode === 'light' ? 'dark-content' : 'light-content'}
          backgroundColor={currentTheme.card}
        />
        <View style={styles.navLeft}>
          <TouchableOpacity onPress={() => setIsSidebarOpen(true)} style={{ marginRight: 10 }} accessibilityLabel="Abrir historial">
            <Ionicons name="menu" size={28} color={currentTheme.text} />
          </TouchableOpacity>
          <View style={[styles.navAvatarCircle, { backgroundColor: '#FFFFFF', borderColor: currentTheme.border }]}>
            <Image
              source={llamaLogo}
              style={styles.navAvatarImage}
              contentFit="contain"
            />
          </View>
          <View style={{ marginLeft: 10 }}>
            <Text style={[styles.navTitle, { color: currentTheme.text }]} numberOfLines={1}>Llama 3.3</Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: currentTheme.primary }}>Asistente IA </Text>
          </View>
        </View>

        {/* FOTO DE PERFIL DEL USUARIO */}
        <View style={[styles.navRight, { flexDirection: 'row', alignItems: 'center' }]}>
          <TouchableOpacity
            onPress={() => setAccountModalVisible(true)}
            style={[
              styles.accountNavButton,
              {
                backgroundColor: currentTheme.card,
                borderColor: currentTheme.border,
                borderWidth: clayStyles.borderWidth,
                shadowColor: currentTheme.borderShadow || '#000',
                shadowOpacity: 0.1,
                shadowOffset: { width: 0, height: 4 },
                shadowRadius: 5,
                elevation: 4,
              },
            ]}
            activeOpacity={0.7}
            accessibilityLabel="Abrir menú de cuenta"
          >
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.accountAvatarNavImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
              />
            ) : (
              <Ionicons
                name="person-circle-outline"
                size={26}
                color={currentTheme.primary}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* MENSAJES */}
      <FlatList
        ref={flatListRef}
        style={styles.messageList}
        data={messages}
        keyExtractor={item => item.id}
        inverted
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentContainerStyle={styles.chatList}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        extraData={themeMode}
        renderItem={({ item }) => (
          <Animated.View
            entering={item.sender === 'user' ? FadeInRight.duration(200) : FadeInLeft.duration(200)}
            style={[
              styles.messageRow,
              item.sender === 'user' ? styles.userRow : styles.botRow,
            ]}
          >
            {item.sender === 'bot' && (
              <View style={[styles.avatarCircle, { backgroundColor: '#FFFFFF', borderColor: currentTheme.border }]}>
                <Image
                  source={llamaLogo}
                  style={styles.avatarImage}
                  contentFit="contain"
                />
              </View>
            )}
            <View
              style={[
                styles.messageBubble,
                item.sender === 'user'
                  ? [styles.userBubble, { backgroundColor: themeMode === 'light' ? '#E4E4E7' : '#3F3F46' }]
                  : [styles.botBubble, { backgroundColor: currentTheme.card }],
              ]}
            >
              <Text style={[styles.messageText, { color: item.sender === 'user' ? (themeMode === 'light' ? '#121212' : '#FFFFFF') : currentTheme.text }]}>
                {item.text}
              </Text>

              {item.sender === 'bot' && item.engineUsed && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, alignSelf: 'flex-end', opacity: 0.8 }}>
                  <Ionicons
                    name={item.engineUsed === 'ia' ? "globe-outline" : "flash-outline"}
                    size={11}
                    color={item.engineUsed === 'ia' ? '#3B82F6' : '#EAB308'}
                    style={{ marginRight: 3 }}
                  />
                  <Text style={{ fontSize: 10, fontWeight: '600', color: item.engineUsed === 'ia' ? '#3B82F6' : '#EAB308' }}>
                    {item.engineUsed === 'ia' ? 'Llama 3.3' : 'Motor Local'}
                  </Text>
                </View>
              )}

              {item.matches && item.matches.length > 0 && (
                <View style={styles.matchesContainer}>
                  {item.matches.map(renderResultCard)}
                </View>
              )}
            </View>
          </Animated.View>
        )}
        ListHeaderComponent={
          isTyping ? (
            <View style={styles.botRow}>
              <View style={[styles.avatarCircle, { backgroundColor: '#FFFFFF', borderColor: currentTheme.border }]}>
                <Image
                  source={llamaLogo}
                  style={styles.avatarImage}
                  contentFit="contain"
                />
              </View>
              <View style={[styles.messageBubble, styles.botBubble, { backgroundColor: currentTheme.card, width: 60, justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="ellipsis-horizontal" size={24} color={currentTheme.textSecondary} />
              </View>
            </View>
          ) : null
        }
      />

      {/* ESTADO DE GRABACIÓN DE VOZ */}
      {(isRecording || isTranscribing) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: isRecording ? '#EF444420' : currentTheme.primary + '20', paddingVertical: 6, paddingHorizontal: 12 }}>
          <Ionicons
            name={isRecording ? "mic" : "sync"}
            size={16}
            color={isRecording ? "#EF4444" : currentTheme.primary}
            style={{ marginRight: 6 }}
          />
          <Text style={{ fontSize: 12, fontWeight: 'bold', color: isRecording ? "#EF4444" : currentTheme.primary }}>
            {isRecording ? "Grabando voz..." : "Transcribiendo audio..."}
          </Text>
        </View>
      )}

      {/* INPUT BAR */}
      <View style={[styles.inputArea, { backgroundColor: currentTheme.card, borderTopColor: currentTheme.border }]}>
        <TouchableOpacity
          style={{ padding: 10, marginRight: 4, opacity: isRecording ? 1 : 0.8 }}
          onPress={handleVoiceToggle}
          disabled={isTranscribing}
        >
          <Ionicons
            name={isRecording ? "mic-off" : "mic-outline"}
            size={24}
            color={isRecording ? "#EF4444" : currentTheme.textSecondary}
          />
        </TouchableOpacity>

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: currentTheme.background,
              borderColor: currentTheme.border,
              color: currentTheme.text,
            },
          ]}
          placeholder={isRecording ? "Grabando..." : "Preguntale a Llama 3.3"}
          placeholderTextColor={currentTheme.textSecondary}
          value={input}
          onChangeText={setInput}
          multiline
          editable={!isTyping && !isRecording}
          returnKeyType="send"
          blurOnSubmit={false}
          textAlignVertical="top"
          allowFontScaling={true}
        />

        <TouchableOpacity
          style={[
            styles.sendBtn,
            {
              backgroundColor: currentTheme.primary,
              opacity: !input.trim() || isTyping ? 0.5 : 1,
            },
          ]}
          onPress={handleSend}
          disabled={!input.trim() || isTyping}
          accessibilityLabel="Enviar mensaje"
          accessibilityRole="button"
        >
          <Ionicons name="send" size={18} color={currentTheme.primaryText || '#fff'} />
        </TouchableOpacity>
      </View>

      <View style={[styles.disclaimerBar, { backgroundColor: currentTheme.card }]}>
        <Text style={[styles.disclaimerText, { color: currentTheme.textSecondary }]} allowFontScaling={true}>
          ⚠️ Esta IA puede cometer errores
        </Text>

      </View>

      {/* MODAL DE CUENTA Y AJUSTES */}
      <AccountModal
        visible={accountModalVisible}
        onClose={() => setAccountModalVisible(false)}
      />

      {/* OVERLAY DEL HISTORIAL */}
      {isSidebarOpen && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[StyleSheet.absoluteFill, { zIndex: 99, backgroundColor: 'rgba(0,0,0,0.6)' }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setIsSidebarOpen(false)} />
        </Animated.View>
      )}

      {/* HISTORIAL INSANO REDISEÑADO */}
      {isSidebarOpen && (
        <Animated.View
          entering={SlideInLeft.duration(300)}
          exiting={SlideOutLeft.duration(300)}
          style={[styles.sidebar, { backgroundColor: currentTheme.card, borderRightColor: currentTheme.border }]}
        >
          {/* HEADER DEL HISTORIAL */}
          <View style={[styles.sidebarHeader, { borderBottomColor: currentTheme.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.sidebarHeaderIconCircle, { backgroundColor: currentTheme.primary + '20' }]}>
                <Ionicons name="chatbubbles-sharp" size={22} color={currentTheme.primary} />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={[styles.sidebarTitle, { color: currentTheme.text }]}>Mis Conversaciones</Text>
                <Text style={{ fontSize: 11, color: currentTheme.textSecondary, fontWeight: '600' }}>
                  {sessions.length} {sessions.length === 1 ? 'chat activo' : 'chats activos'}
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={() => setIsSidebarOpen(false)} style={styles.closeSidebarBtn}>
              <Ionicons name="close" size={22} color={currentTheme.text} />
            </TouchableOpacity>
          </View>

          {/* BOTÓN NUEVO CHAT INSANO */}
          <TouchableOpacity
            style={[
              styles.newSessionBtn,
              clayStyles,
              {
                backgroundColor: currentTheme.primary,
                borderColor: currentTheme.border,
                shadowColor: currentTheme.borderShadow || '#000',
              },
            ]}
            onPress={handleNewSession}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={22} color="#fff" style={{ marginRight: 8 }} />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Nuevo Chat</Text>
          </TouchableOpacity>

          {/* LISTA DE SESIONES REDISEÑADA */}
          <FlatList
            data={sessions}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.sessionListContent}
            renderItem={({ item }) => {
              const isSelected = currentSessionId === item.id;
              return (
                <TouchableOpacity
                  style={[
                    styles.sessionCard,
                    clayStyles,
                    {
                      backgroundColor: isSelected ? currentTheme.primary + '15' : currentTheme.card,
                      borderColor: isSelected ? currentTheme.primary : currentTheme.border,
                      borderWidth: isSelected ? 2 : clayStyles.borderWidth,
                      shadowColor: currentTheme.borderShadow || '#000',
                    },
                  ]}
                  onPress={() => {
                    setCurrentSessionId(item.id);
                    setIsSidebarOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.sessionIconCircle, { backgroundColor: isSelected ? currentTheme.primary : currentTheme.background }]}>
                    <Ionicons
                      name={isSelected ? "chatbubble" : "chatbubble-outline"}
                      size={18}
                      color={isSelected ? '#FFFFFF' : currentTheme.primary}
                    />
                  </View>

                  <View style={{ flex: 1, marginHorizontal: 10 }}>
                    <Text
                      style={[
                        styles.sessionTitleText,
                        {
                          color: isSelected ? currentTheme.primary : currentTheme.text,
                          fontWeight: isSelected ? '800' : '600',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {item.title || 'Nueva conversación'}
                    </Text>
                    <Text style={{ fontSize: 10, color: currentTheme.textSecondary, marginTop: 2 }}>
                      {isSelected ? '● Conversación actual' : 'Toca para abrir'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleDeleteSession(item.id)}
                    style={styles.deleteSessionBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptySessionContainer}>
                <Ionicons name="chatbubbles-outline" size={48} color={currentTheme.textSecondary} style={{ opacity: 0.5, marginBottom: 12 }} />
                <Text style={{ color: currentTheme.textSecondary, fontSize: 13, textAlign: 'center' }}>
                  No tienes chats archivados. Toca "+ Nuevo Chat" para iniciar.
                </Text>
              </View>
            }
          />
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navbar: {
    height: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 45,
    borderBottomWidth: 1,
    elevation: 4,
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  navAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  navAvatarImage: {
    width: 32,
    height: 32,
  },
  accountNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  accountAvatarNavImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
    width: '100%',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  botRow: {
    justifyContent: 'flex-start',
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginRight: 8,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  avatarImage: {
    width: 30,
    height: 30,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatList: {
    padding: 16,
    paddingBottom: 20,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 20,
    marginBottom: 16,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  matchesContainer: {
    marginTop: 12,
  },
  resultCard: {
    padding: 16,
    marginTop: 8,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  cardSubtitle: {
    fontSize: 13,
    marginBottom: 6,
  },
  cardLocation: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  redirectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
  },
  redirectBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  inputArea: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'android' ? 12 : 24,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderWidth: clayStyles.borderWidth,
    borderRadius: clayStyles.borderRadius,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'android' ? 8 : 12,
    fontSize: 15,
    marginRight: 10,
    minHeight: 44,
    maxHeight: 120,
  },
  disclaimerBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150,150,150,0.15)',
  },
  disclaimerText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageList: {
    flex: 1,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 300,
    borderRightWidth: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 25,
    elevation: 10,
    zIndex: 100,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 4, height: 0 },
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sidebarHeaderIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeSidebarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  newSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 16,
    elevation: 4,
  },
  sessionListContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    borderRadius: 16,
    elevation: 3,
  },
  sessionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionTitleText: {
    fontSize: 14,
  },
  deleteSessionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EF444415',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptySessionContainer: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
