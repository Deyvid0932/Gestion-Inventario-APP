import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, SlideInLeft, SlideOutLeft } from 'react-native-reanimated';
import { clayStyles, ThemeType } from '../../styles/theme';
import { ChatSession } from '../../types';

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  theme: ThemeType;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  isOpen,
  onClose,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  theme,
}) => {
  if (!isOpen) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* OVERLAY / BACKDROP CLICABLE */}
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={[StyleSheet.absoluteFill, styles.overlay]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          activeOpacity={1}
          accessibilityLabel="Cerrar menú"
        />
      </Animated.View>

      {/* SIDEBAR DE HISTORIAL */}
      <Animated.View
        entering={SlideInLeft.duration(250)}
        exiting={SlideOutLeft.duration(200)}
        style={[
          styles.sidebar,
          {
            backgroundColor: theme.card,
            borderRightColor: theme.border,
            elevation: 10,
            zIndex: 100,
          },
        ]}
      >
        <View style={[styles.sidebarHeader, { borderBottomColor: theme.border }]}>
          <View style={styles.headerLeftRow}>
            <View style={[styles.sidebarHeaderIconCircle, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="chatbubbles-sharp" size={22} color={theme.primary} />
            </View>
            <View style={styles.headerTitleCol}>
              <Text style={[styles.sidebarTitle, { color: theme.text }]}>Mis Conversaciones</Text>
              <Text style={[styles.sidebarSubtitle, { color: theme.textSecondary }]}>
                {sessions.length} {sessions.length === 1 ? 'chat activo' : 'chats activos'}
              </Text>
            </View>
          </View>

          <TouchableOpacity onPress={onClose} style={styles.closeSidebarBtn} accessibilityLabel="Cerrar menú">
            <Ionicons name="close" size={22} color={theme.text} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.newSessionBtn,
            clayStyles,
            {
              backgroundColor: theme.primary,
              borderColor: theme.border,
              shadowColor: theme.borderShadow || '#000',
            },
          ]}
          onPress={onNewSession}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={22} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.newSessionBtnText}>Nuevo Chat</Text>
        </TouchableOpacity>

        <FlatList
          data={sessions}
          keyExtractor={item => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={styles.sessionListContent}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const isSelected = currentSessionId === item.id;
            return (
              <View
                style={[
                  styles.sessionCard,
                  {
                    backgroundColor: isSelected ? theme.primary + '18' : theme.card,
                    borderColor: isSelected ? theme.primary : theme.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.sessionMainTouch}
                  onPress={() => onSelectSession(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.sessionIconCircle, { backgroundColor: isSelected ? theme.primary : theme.background }]}>
                    <Ionicons
                      name={isSelected ? 'chatbubble' : 'chatbubble-outline'}
                      size={18}
                      color={isSelected ? '#FFFFFF' : theme.primary}
                    />
                  </View>

                  <View style={styles.sessionTitleCol}>
                    <Text
                      style={[
                        styles.sessionTitleText,
                        {
                          color: isSelected ? theme.primary : theme.text,
                          fontWeight: isSelected ? '800' : '600',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {item.title || 'Nueva conversación'}
                    </Text>
                    <Text style={[styles.sessionSubtitle, { color: theme.textSecondary }]}>
                      {isSelected ? '● Conversación actual' : 'Toca para abrir'}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => onDeleteSession(item.id)}
                  style={styles.deleteSessionBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  activeOpacity={0.6}
                  accessibilityLabel="Eliminar chat"
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptySessionContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color={theme.textSecondary} style={{ opacity: 0.5, marginBottom: 12 }} />
              <Text style={[styles.emptySessionText, { color: theme.textSecondary }]}>
                No tienes chats archivados. Toca "+ Nuevo Chat" para iniciar.
              </Text>
            </View>
          }
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 99,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '80%',
    zIndex: 100,
    borderRightWidth: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 35,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sidebarHeaderIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleCol: {
    marginLeft: 10,
  },
  sidebarTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sidebarSubtitle: {
    fontSize: 11,
    fontWeight: '600',
  },
  closeSidebarBtn: {
    padding: 6,
  },
  newSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  newSessionBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  sessionListContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    marginBottom: 10,
  },
  sessionMainTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  sessionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionTitleCol: {
    flex: 1,
    marginHorizontal: 10,
  },
  sessionTitleText: {
    fontSize: 13,
  },
  sessionSubtitle: {
    fontSize: 10,
    marginTop: 2,
  },
  deleteSessionBtn: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptySessionContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptySessionText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
