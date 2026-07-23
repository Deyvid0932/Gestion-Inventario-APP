import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, Platform, KeyboardAvoidingView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { clayStyles, SCHEME_COLORS, ColorSchemeType } from '../style/theme';
import { useSQLiteContext } from 'expo-sqlite';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Animated, { FadeIn, FadeInRight, FadeInLeft, SlideInLeft, SlideOutLeft, FadeOut } from 'react-native-reanimated';
import { useAppStore } from '../store/useAppStore';
import { ChatbotService } from '../services/ChatbotService';
import { SearchResult } from '../utils/nlpEngine';
import { RootStackParamList, ChatSession } from '../types';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  matches?: SearchResult[];
  engineUsed?: 'ia' | 'local';
}

export const ChatbotScreen = () => {
  const db = useSQLiteContext();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { currentTheme, themeMode, toggleTheme, colorScheme, setColorScheme } = useAppStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const lastNavTime = useRef(0);

  useEffect(() => {
    const loadSessions = async () => {
      const allSessions = await ChatbotService.getSessions(db);
      setSessions(allSessions);
      if (allSessions.length > 0) {
        setCurrentSessionId(allSessions[0].id);
      } else {
        const newSessionId = await ChatbotService.createSession(db, 'Nueva sesión');
        setCurrentSessionId(newSessionId);
        setSessions(await ChatbotService.getSessions(db));
      }
    };
    loadSessions();
  }, [db]);

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
          text: '¡Hola! Soy Gemini NLP, tu Copiloto inteligente. ¿En qué te puedo ayudar hoy con tu inventario?'
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
      setSessions(await ChatbotService.getSessions(db));
    }

    const userMsgId = Date.now().toString();
    const newUserMsg: ChatMessage = { id: userMsgId, sender: 'user', text: userText };
    setMessages(prev => [newUserMsg, ...prev]);
    setInput('');
    setIsTyping(true);

    await ChatbotService.saveMessage(db, { id: userMsgId, sender: 'user', text: userText, timestamp: Date.now() }, currentSessionId);

    const response = await ChatbotService.searchAndRespond(db, userText, currentSessionId);

    const botMsgId = (Date.now() + 1).toString();
    const botMsg: ChatMessage = {
      id: botMsgId,
      sender: 'bot',
      text: response.text,
      matches: response.matches,
      engineUsed: response.engineUsed
    };

    setMessages(prev => [botMsg, ...prev]);
    setIsTyping(false);

    await ChatbotService.saveMessage(db, { id: botMsgId, sender: 'bot', text: response.text, matches: response.matches, engineUsed: response.engineUsed, timestamp: Date.now() }, currentSessionId);
  };

  const handleNewSession = async () => {
    setIsSidebarOpen(false);
    const newSessionId = await ChatbotService.createSession(db, 'Nueva sesión');
    setCurrentSessionId(newSessionId);
    setSessions(await ChatbotService.getSessions(db));
    setMessages([{
      id: '1',
      sender: 'bot',
      text: '¡Hola! Soy North Mini Code ✨, tu asistente inteligente del inventario. ¿En qué puedo ayudarte hoy?'
    }]);
  };

  const handleDeleteSession = (id: string) => {
    Alert.alert("Borrar Chat", "¿Estás seguro de borrar esta conversación?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar", style: "destructive", onPress: async () => {
          await ChatbotService.deleteSession(db, id);
          const updatedSessions = await ChatbotService.getSessions(db);
          setSessions(updatedSessions);
          if (currentSessionId === id) {
            if (updatedSessions.length > 0) {
              setCurrentSessionId(updatedSessions[0].id);
            } else {
              handleNewSession();
            }
          }
        }
      }
    ]);
  };

  const handleClear = () => {
    if (!currentSessionId) return;
    handleDeleteSession(currentSessionId);
  };

  const renderResultCard = (match: SearchResult) => (
    <Animated.View entering={FadeIn.delay(200)} key={match.id} style={[styles.resultCard, clayStyles, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
      <Text style={{ color: currentTheme.text, fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>
        {(match.estilo || 'Sin Estilo').toUpperCase()}
      </Text>

      <View style={styles.cardRow}>
        <Ionicons name="shirt" size={16} color={currentTheme.primary} style={{ marginRight: 6 }} />
        <Text style={[styles.cardTitle, { color: currentTheme.text }]}>OP: {match.op || 'Sin OP'}</Text>
      </View>

      <Text style={[styles.cardSubtitle, { color: currentTheme.textSecondary, marginTop: 4 }]}>
        Color: {match.color || 'No especificado'}
      </Text>
      <Text style={[styles.cardLocation, { color: currentTheme.primary, marginTop: 4 }]}>📍 {match.cajaNombre || 'Sin Caja'} → {match.inventarioNombre || 'General'}</Text>

      {match.alarmaFechaHora && (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: currentTheme.primary + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 8, alignSelf: 'flex-start' }}>
          <Ionicons name="time-outline" size={14} color={currentTheme.primary} style={{ marginRight: 4 }} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: currentTheme.primary }}>
            Alarma: {new Date(match.alarmaFechaHora).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} {new Date(match.alarmaFechaHora).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.redirectBtn, { backgroundColor: currentTheme.primary + '20' }]}
        onPress={() => navigateSafe('ExcelGrid', { cajaId: match.cajaId, nombreCaja: match.cajaNombre, targetPrendaId: match.id })}
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

      <View style={[styles.navbar, { backgroundColor: currentTheme.card, borderBottomColor: currentTheme.border }]}>
        <StatusBar
          barStyle={themeMode === 'light' ? 'dark-content' : 'light-content'}
          backgroundColor={currentTheme.card}
        />
        <View style={styles.navLeft}>
          <TouchableOpacity onPress={() => setIsSidebarOpen(true)} style={{ marginRight: 12 }}>
            <Ionicons name="menu" size={28} color={currentTheme.text} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: currentTheme.text }]} numberOfLines={1}>Groq IA</Text>
        </View>
        <View style={[styles.navRight, { flexDirection: 'row', alignItems: 'center' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
            {(['morado', 'dorado', 'celeste'] as ColorSchemeType[]).map((schemeKey) => (
              <TouchableOpacity
                key={schemeKey}
                onPress={() => setColorScheme(schemeKey)}
                activeOpacity={0.7}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  marginHorizontal: 3,
                  backgroundColor: SCHEME_COLORS[schemeKey],
                  borderWidth: colorScheme === schemeKey ? 2 : 0,
                  borderColor: themeMode === 'light' ? '#000000' : '#FFFFFF',
                }}
              />
            ))}
          </View>


          <TouchableOpacity
            onPress={toggleTheme}
            style={{ width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: themeMode === 'light' ? '#F4F4F5' : '#27272A' }}
            activeOpacity={0.7}
          >
            <Ionicons name={themeMode === 'light' ? "moon-outline" : "sunny-outline"} size={20} color={currentTheme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        style={styles.messageList}
        data={messages}
        keyExtractor={item => item.id}
        inverted
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentContainerStyle={styles.chatList}
        removeClippedSubviews={Platform.OS === 'android'}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        extraData={themeMode}

        renderItem={({ item }) => (
          <Animated.View
            entering={item.sender === 'user' ? FadeInRight.duration(200) : FadeInLeft.duration(200)}
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
                  {item.engineUsed === 'ia' ? 'Groq' : 'Motor Local'}
                </Text>
              </View>
            )}

            {item.matches && item.matches.length > 0 && (
              <View style={styles.matchesContainer}>
                {item.matches.map(renderResultCard)}
              </View>
            )}
          </Animated.View>
        )}
        ListHeaderComponent={
          isTyping ? (
            <View style={[styles.messageBubble, styles.botBubble, { backgroundColor: currentTheme.card, alignSelf: 'flex-start', width: 60 }]}>
              <Ionicons name="ellipsis-horizontal" size={24} color={currentTheme.textSecondary} />
            </View>
          ) : null
        }
      />

      <View style={[styles.inputArea, { backgroundColor: currentTheme.card, borderTopColor: currentTheme.border }]}>
        <TextInput
          style={[
            styles.input,
            {
              color: currentTheme.text,
              backgroundColor: currentTheme.background,
              borderColor: currentTheme.border,
            },
          ]}
          placeholder="Ej: ¿Dónde está la OP 123?"
          placeholderTextColor={currentTheme.textSecondary}
          value={input}
          onChangeText={setInput}
          multiline
          editable={!isTyping}
          returnKeyType="send"
          blurOnSubmit={false}
          textAlignVertical="top"
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
        >
          <Ionicons name="send" size={18} color={currentTheme.primaryText || '#fff'} />
        </TouchableOpacity>
      </View>

      <View style={[styles.disclaimerBar, { backgroundColor: currentTheme.card }]}>
        <Text style={[styles.disclaimerText, { color: currentTheme.textSecondary }]}>
          ⚠️ Esta IA puede cometer errores
        </Text>
        <Text style={[styles.disclaimerText, { color: currentTheme.textSecondary, opacity: 0.6 }]}>
          Creador: Deyvid Jair Chupillon Silva
        </Text>
      </View>

      {isSidebarOpen && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[StyleSheet.absoluteFill, { zIndex: 99, backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setIsSidebarOpen(false)} />
        </Animated.View>
      )}
      {isSidebarOpen && (
        <Animated.View
          entering={SlideInLeft.duration(300)}
          exiting={SlideOutLeft.duration(300)}
          style={[styles.sidebar, { backgroundColor: currentTheme.card, borderRightColor: currentTheme.border }]}
        >
          <View style={styles.sidebarHeader}>
            <Text style={[styles.sidebarTitle, { color: currentTheme.text }]}>Historial de Chats</Text>
            <TouchableOpacity onPress={() => setIsSidebarOpen(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={currentTheme.text} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.newSessionBtn, { backgroundColor: currentTheme.primary }]}
            onPress={handleNewSession}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 8 }}>Nuevo Chat</Text>
          </TouchableOpacity>

          <FlatList
            data={sessions}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.sessionItem,
                  currentSessionId === item.id && { backgroundColor: themeMode === 'light' ? '#E4E4E7' : '#3F3F46' }
                ]}
                onPress={() => {
                  setCurrentSessionId(item.id);
                  setIsSidebarOpen(false);
                }}
              >
                <Ionicons name="chatbubble-outline" size={20} color={currentTheme.text} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: currentTheme.text, fontWeight: currentSessionId === item.id ? 'bold' : 'normal' }} numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteSession(item.id)} style={{ padding: 4 }}>
                  <Ionicons name="trash-outline" size={18} color={currentTheme.textSecondary} />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
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
    elevation: 2,
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  botAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  navTitle: {
    fontSize: 20,
    fontWeight: '700',
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
    padding: 12,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150,150,150,0.15)',
  },
  disclaimerText: {
    fontSize: 9,
    fontWeight: '500',
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
    width: 280,
    borderRightWidth: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    elevation: 5,
    zIndex: 100,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  newSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    margin: 16,
    borderRadius: 12,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.1)',
  }
});
