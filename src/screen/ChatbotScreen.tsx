import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, KeyboardAvoidingView, Platform } from 'react-native';
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
  const { currentTheme } = useAppStore();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const lastNavTime = useRef(0);

  // Mensaje de bienvenida inicial
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: '1',
        sender: 'bot',
        text: '¡Hola! Soy tu asistente inteligente (Gemini NLP). Pregúntame dónde está alguna prenda.'
      }]);
    }
  }, []);

  const navigateSafe = useCallback((routeName: keyof RootStackParamList, params?: any) => {
    const now = Date.now();
    if (now - lastNavTime.current < 400) return;
    lastNavTime.current = now;
    navigation.navigate(routeName as any, params);
  }, [navigation]);

  const handleSend = async () => {
    const userText = input.trim();
    if (!userText) return;

    // 1. Agregar mensaje de usuario (usamos id basado en tiempo para que se ordene bien en un arreglo)
    const newUserMsg: ChatMessage = { id: Date.now().toString(), sender: 'user', text: userText };
    setMessages(prev => [newUserMsg, ...prev]);
    setInput('');
    setIsTyping(true);

    // 2. Procesar con Gemini y SQL
    const response = await ChatbotService.searchAndRespond(db, userText);
    
    // 3. Agregar respuesta del bot
    const botMsg: ChatMessage = { 
      id: (Date.now() + 1).toString(), 
      sender: 'bot', 
      text: response.text, 
      matches: response.matches 
    };
    
    setMessages(prev => [botMsg, ...prev]);
    setIsTyping(false);
  };

  const handleClear = () => {
    Alert.alert("Limpiar Chat", "¿Borrar toda la conversación?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar", style: "destructive", onPress: () => {
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
      <View style={styles.cardRow}>
        <Ionicons name="shirt" size={16} color={currentTheme.primary} style={{marginRight: 6}} />
        <Text style={[styles.cardTitle, { color: currentTheme.text }]}>OP: {match.op || 'Sin OP'}</Text>
      </View>
      <Text style={[styles.cardSubtitle, { color: currentTheme.textSecondary }]}>Estilo: {match.estilo} | Color: {match.color}</Text>
      <Text style={[styles.cardLocation, { color: currentTheme.primary }]}>📍 {match.cajaNombre} → {match.inventarioNombre}</Text>
      
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
  // CAMBIO 1: Eliminamos KeyboardAvoidingView y usamos un View normal con flex: 1
  <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
    
    {/* Navbar (Mantiene tu diseño original) */}
    <View style={[styles.navbar, { borderBottomColor: currentTheme.border }]}>
      <View style={styles.navLeft}>
        <View style={[styles.botAvatar, { backgroundColor: currentTheme.primary + '20' }]}>
          <Ionicons name="sparkles" size={20} color={currentTheme.primary} />
        </View>
        <Text style={[styles.navTitle, { color: currentTheme.text }]}>Asistente</Text>
      </View>
      <TouchableOpacity onPress={handleClear} style={styles.navRight}>
        <Ionicons name="trash-outline" size={22} color={currentTheme.textSecondary} />
      </TouchableOpacity>
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
      
      renderItem={({ item }) => (
        <Animated.View
          entering={item.sender === 'user' ? FadeInRight.duration(200) : FadeInLeft.duration(200)}
          style={[
            styles.messageBubble,
            item.sender === 'user'
              ? [styles.userBubble, { backgroundColor: currentTheme.primary }]
              : [styles.botBubble, { backgroundColor: currentTheme.card }],
          ]}
        >
          <Text style={[styles.messageText, { color: item.sender === 'user' ? '#fff' : currentTheme.text }]}>
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
        <Ionicons name="send" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  </View>
);
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: 'bold',
  },
  navRight: {
    padding: 5,
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
