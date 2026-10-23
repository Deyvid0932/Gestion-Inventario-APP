import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeType } from '../../styles/theme';

interface ChatInputBarProps {
  input: string;
  setInput: (text: string) => void;
  onSend: (text?: string) => void;
  isTyping: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  onVoiceToggle: () => void;
  theme: ThemeType;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  input,
  setInput,
  onSend,
  isTyping,
  isRecording,
  isTranscribing,
  onVoiceToggle,
  theme,
}) => {
  return (
    <View>
      {/* ESTADO DE GRABACIÓN DE VOZ */}
      {(isRecording || isTranscribing) && (
        <View
          style={[
            styles.voiceStatusBanner,
            { backgroundColor: isRecording ? '#EF444420' : theme.primary + '20' }
          ]}
        >
          <Ionicons
            name={isRecording ? 'mic' : 'sync'}
            size={16}
            color={isRecording ? '#EF4444' : theme.primary}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.voiceStatusText, { color: isRecording ? '#EF4444' : theme.primary }]}>
            {isRecording ? 'Grabando voz...' : 'Transcribiendo audio...'}
          </Text>
        </View>
      )}

      {/* INPUT BAR */}
      <View style={[styles.inputArea, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.micBtn, { opacity: isRecording ? 1 : 0.8 }]}
          onPress={onVoiceToggle}
          disabled={isTranscribing}
          accessibilityLabel="Grabar voz"
        >
          <Ionicons
            name={isRecording ? 'mic-off' : 'mic-outline'}
            size={24}
            color={isRecording ? '#EF4444' : theme.textSecondary}
          />
        </TouchableOpacity>

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.background,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
          placeholder={isRecording ? 'Grabando voz...' : 'Pregúntale a Topytop IA...'}
          placeholderTextColor={theme.textSecondary}
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
              backgroundColor: input.trim() && !isTyping ? theme.primary : theme.textSecondary + '40',
            },
          ]}
          disabled={!input.trim() || isTyping || isRecording}
          onPress={() => onSend()}
          accessibilityLabel="Enviar mensaje"
        >
          <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  voiceStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  voiceStatusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    borderTopWidth: 1,
  },
  micBtn: {
    padding: 10,
    marginRight: 4,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
