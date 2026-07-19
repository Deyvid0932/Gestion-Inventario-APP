import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, Platform, KeyboardAvoidingView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Animated, { FadeIn, FadeInRight, FadeInLeft } from 'react-native-reanimated';
import { useAppStore } from '../store/useAppStore';
import { ChatbotService } from '../services/ChatbotService';
import { SearchResult } from '../utils/nlpEngine';
import { RootStackParamList } from '../types';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  matches?: SearchResult[];
}

export const ChatbotScreen = () => {
  const db = useSQLiteContext();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { currentTheme, themeMode } = useAppStore();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const lastNavTime = useRef(0);

  // Cargar historial al inicio
  useEffect(() => {
    const loadHistory = async () => {
      const history = await ChatbotService.getHistory(db);
      if (history.length > 0) {
        setMessages(history);
      } else {
        setMessages([{
          id: '1',
          sender: 'bot',
          text: '¡Hola! Soy tu asistente inteligente. Pregúntame dónde está alguna prenda.'
        }]);
      }
    };
    loadHistory();
  }, [db]);

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
    if (!userText) return;

    const userMsgId = Date.now().toString();
    const newUserMsg: ChatMessage = { id: userMsgId, sender: 'user', text: userText };
    setMessages(prev => [newUserMsg, ...prev]);
    setInput('');
    setIsTyping(true);

    // Guardar en BD
    await ChatbotService.saveMessage(db, { id: userMsgId, sender: 'user', text: userText, timestamp: Date.now() });

    // 2. Procesar con Gemini y SQL
    const response = await ChatbotService.searchAndRespond(db, userText);
    
    const botMsgId = (Date.now() + 1).toString();
    const botMsg: ChatMessage = { 
      id: botMsgId, 
      sender: 'bot', 
      text: response.text, 
      matches: response.matches 
    };
    
    setMessages(prev => [botMsg, ...prev]);
    setIsTyping(false);

    // Guardar en BD
    await ChatbotService.saveMessage(db, { id: botMsgId, sender: 'bot', text: response.text, matches: response.matches, timestamp: Date.now() });
  };

  const handleClear = () => {
    Alert.alert("Limpiar Historial", "¿Borrar toda la conversación?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar", style: "destructive", onPress: async () => {
          await ChatbotService.clearHistory(db);
          setMessages([{
            id: Date.now().toString(),
            sender: 'bot',
            text: 'Conversación borrada. ¿En qué te ayudo?'
          }]);
      }}
    ]);
  };

  const renderResultCard = (match: SearchResult) => (
    <Animated.View entering={FadeIn.delay(200)} key={match.id} style={[styles.resultCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
      <Text style={{ color: currentTheme.text, fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>
        {match.estilo.toUpperCase()}
      </Text>
      
      <View style={styles.cardRow}>
        <Ionicons name="shirt" size={16} color={currentTheme.primary} style={{marginRight: 6}} />
        <Text style={[styles.cardTitle, { color: currentTheme.text }]}>OP: {match.op || 'Sin OP'}</Text>
      </View>
      
      <Text style={[styles.cardSubtitle, { color: currentTheme.textSecondary, marginTop: 4 }]}>
        Color: {match.color}
      </Text>
      <Text style={[styles.cardLocation, { color: currentTheme.primary, marginTop: 4 }]}>📍 {match.cajaNombre} → {match.inventarioNombre}</Text>
      
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
    
    {/* Navbar (Clon exacto de Navbar.tsx) */}
    <View style={[styles.navbar, { backgroundColor: currentTheme.card, borderBottomColor: currentTheme.border }]}>
      <StatusBar 
        barStyle={themeMode === 'light' ? 'dark-content' : 'light-content'} 
        backgroundColor={currentTheme.card} 
      />
      <View style={styles.navLeft}>
        <Text style={[styles.navTitle, { color: currentTheme.text }]} numberOfLines={1}>Asistente</Text>
      </View>
      <View style={[styles.navRight, { flexDirection: 'row', alignItems: 'center' }]}>
        <TouchableOpacity 
          onPress={handleClear} 
          style={{ marginRight: 12, width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: themeMode === 'light' ? '#F4F4F5' : '#27272A' }}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={22} color={currentTheme.text} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={useAppStore.getState().toggleTheme}
          style={{ width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: themeMode === 'light' ? '#F4F4F5' : '#27272A' }}
          activeOpacity={0.7}
        >
          <Ionicons name={themeMode === 'light' ? "moon-outline" : "sunny-outline"} size={22} color={currentTheme.text} />
        </TouchableOpacity>
      </View>
    </View>

    {/* Mensajes (Lista optimizada) */}
    <FlatList
      ref={flatListRef}
      style={styles.messageList}
      data={messages}
      keyExtractor={item => item.id}
      inverted
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      contentContainerStyle={styles.chatList}
      
      // CAMBIO 2: Desmontado nativo para evitar trabones de renderizado
      removeClippedSubviews={Platform.OS === 'android'}
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      extraData={themeMode} // <-- Fuerza el re-render inmediato al cambiar el tema
      
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

    {/* Entrada (Alineada para que no flote erráticamente) */}
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
        numberOfLines={1} // CAMBIO 3: Estabiliza el cálculo inicial de altura en Android
        textAlignVertical="center" // CAMBIO 4: Clave para que el input no desplace su texto hacia arriba
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
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
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
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'android' ? 8 : 12, // Relleno equilibrado
    fontSize: 15,
    marginRight: 10,
    minHeight: 40,
    maxHeight: 80,
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
}
  
});
