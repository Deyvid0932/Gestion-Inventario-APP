import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInRight, FadeInLeft } from 'react-native-reanimated';
import { Navbar } from '../components';
import { Image } from 'expo-image';
import { SearchResult } from '../utils/nlpEngine';
import { useChatbotScreen } from '../hooks';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { ChatInputBar } from '../components/chat/ChatInputBar';
import { ChatBoxCard } from '../components/chat/ChatBoxCard';
import { ChatGarmentCard } from '../components/chat/ChatGarmentCard';

const topytopIaLogo = require('../../assets/topytop_ia_logo.png');

export const FAQ_SUGGESTIONS = [
  { id: '1', label: '¿Qué apartados tiene la app?' },
  { id: '2', label: '¿Cómo registro una prenda o caja?' },
  { id: '3', label: 'Resumen general del inventario' },
  { id: '4', label: '¿Qué hago si una prenda tiene fallas?' },
];

export const ChatbotScreen = () => {
  const { state, computed, refs, handlers } = useChatbotScreen();
  const {
    messages,
    sessions,
    currentSessionId,
    isSidebarOpen,
    activeModel,
    input,
    isTyping,
    isRecording,
    isTranscribing,
  } = state;

  const { currentTheme, themeMode } = computed;
  const { flatListRef } = refs;

  const {
    setInput,
    setIsSidebarOpen,
    handleSend,
    handleVoiceToggle,
    handleNewSession,
    handleDeleteSession,
    handleSelectSession,
    handleResultItemPress,
    handleBoxPress,
  } = handlers;

  const showFaqSuggestions = !isTyping && messages.length <= 1 && (!messages[0] || messages[0].sender === 'bot');

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
      <Navbar
        title=""
        showBackButton={false}
        leftElement={
          <View style={styles.navLeftContainer}>
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                setIsSidebarOpen(true);
              }}
              style={styles.menuBtn}
              accessibilityLabel="Abrir historial"
            >
              <Ionicons name="menu" size={28} color={currentTheme.text} />
            </TouchableOpacity>
            <View style={[styles.navAvatarCircle, { backgroundColor: '#FFFFFF', borderColor: currentTheme.border }]}>
              <Image
                source={topytopIaLogo}
                style={styles.navAvatarImage}
                contentFit="contain"
              />
            </View>
            <View style={styles.navInfoCol}>
              <Text style={[styles.navTitle, { color: currentTheme.text }]} numberOfLines={1}>Topytop IA</Text>
              <View style={styles.navStatusRow}>
                <View style={styles.navStatusDot} />
                <Text style={[styles.navModelText, { color: currentTheme.primary }]} numberOfLines={1}>
                  {activeModel}
                </Text>
              </View>
            </View>
          </View>
        }
      />

      {/* MENSAJES */}
      <FlatList
        ref={flatListRef}
        key={`chat-messages-${currentSessionId || 'default'}`}
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
        showsVerticalScrollIndicator={false}
        extraData={`${currentSessionId}-${messages.length}-${themeMode}`}
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
                  source={topytopIaLogo}
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
              <Text
                style={[
                  styles.messageText,
                  {
                    color: item.sender === 'user'
                      ? (themeMode === 'light' ? '#121212' : '#FFFFFF')
                      : currentTheme.text,
                  },
                ]}
              >
                {item.text.replace(/\*+/g, '')}
              </Text>

              {item.sender === 'bot' && (
                <View style={styles.botEngineBadgeRow}>
                  <Ionicons
                    name={item.engineUsed === 'ia' ? 'sparkles' : 'flash-outline'}
                    size={11}
                    color={item.engineUsed === 'ia' ? '#3B82F6' : '#EAB308'}
                    style={{ marginRight: 3 }}
                  />
                  <Text style={[styles.botEngineText, { color: item.engineUsed === 'ia' ? '#3B82F6' : '#EAB308' }]}>
                    {item.modelName || (item.engineUsed === 'ia' ? activeModel : 'Motor Local')}
                  </Text>
                </View>
              )}

              {/* Tarjeta de Caja (sin mostrar prendas) */}
              {item.boxMatch && (
                <ChatBoxCard
                  box={item.boxMatch}
                  theme={currentTheme}
                  onOpenBox={handleBoxPress}
                />
              )}

              {/* Tarjetas de Prendas (para búsquedas individuales) */}
              {item.matches && item.matches.length > 0 && (
                <View style={styles.matchesContainer}>
                  {item.matches.map((match: SearchResult) => (
                    <ChatGarmentCard
                      key={match.id}
                      match={match}
                      theme={currentTheme}
                      onPressItem={handleResultItemPress}
                    />
                  ))}
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
                  source={topytopIaLogo}
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

      {/* CHIPS DE SUGERENCIAS RÁPIDAS (FAQ) */}
      {showFaqSuggestions && (
        <View style={styles.faqContainer}>
          <Text style={[styles.faqHeaderTitle, { color: currentTheme.textSecondary }]}>
            Preguntas frecuentes
          </Text>
          <View style={styles.faqGrid}>
            {FAQ_SUGGESTIONS.map(item => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.faqChip,
                  {
                    backgroundColor: themeMode === 'light' ? '#F4F4F5' : '#27272A',
                    borderColor: currentTheme.border,
                  },
                ]}
                activeOpacity={0.7}
                onPress={() => handleSend(item.label)}
              >
                <Text style={[styles.faqChipText, { color: currentTheme.text }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* INPUT BAR Y GRABACIÓN DE VOZ */}
      <ChatInputBar
        input={input}
        setInput={setInput}
        onSend={handleSend}
        isTyping={isTyping}
        isRecording={isRecording}
        isTranscribing={isTranscribing}
        onVoiceToggle={handleVoiceToggle}
        theme={currentTheme}
      />

        <View style={[styles.disclaimerBar, { backgroundColor: currentTheme.card }]}>
          <Text style={[styles.disclaimerText, { color: currentTheme.textSecondary }]} allowFontScaling={true}>
            Esta IA puede cometer errores
          </Text>
        </View>
      </KeyboardAvoidingView>

      {/* SIDEBAR DE HISTORIAL */}
      <ChatSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        theme={currentTheme}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navLeftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuBtn: {
    marginRight: 10,
  },
  navAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    padding: 2,
  },
  navAvatarImage: {
    width: 38,
    height: 38,
  },
  navInfoCol: {
    marginLeft: 10,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  navStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  navStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  navModelText: {
    fontSize: 11,
    fontWeight: '700',
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
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    marginRight: 8,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    padding: 2,
  },
  avatarImage: {
    width: 32,
    height: 32,
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  messageText: {
    fontSize: 13.5,
    lineHeight: 19.5,
  },
  botEngineBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    alignSelf: 'flex-end',
    opacity: 0.85,
  },
  botEngineText: {
    fontSize: 10,
    fontWeight: '700',
  },
  messageList: {
    flex: 1,
  },
  matchesContainer: {
    marginTop: 10,
  },
  disclaimerBar: {
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimerText: {
    fontSize: 8,
    opacity: 0.7,
  },
  faqContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  faqHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  faqGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  faqChip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
  },
  faqChipText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
});
