import { Audio } from 'expo-av';
import { Platform } from 'react-native';

let recordingInstance: Audio.Recording | null = null;

export const VoiceService = {
  requestPermissions: async (): Promise<boolean> => {
    try {
      const response = await Audio.requestPermissionsAsync();
      return response.status === 'granted';
    } catch (e) {
      console.error('[VoiceService] Error al solicitar permisos de micrófono:', e);
      return false;
    }
  },

  startRecording: async (): Promise<boolean> => {
    try {
      const hasPermission = await VoiceService.requestPermissions();
      if (!hasPermission) {
        return false;
      }

      if (recordingInstance) {
        await VoiceService.stopRecording();
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingInstance = recording;
      return true;
    } catch (e) {
      console.error('[VoiceService] Error al iniciar la grabación:', e);
      recordingInstance = null;
      return false;
    }
  },

  stopRecordingAndTranscribe: async (): Promise<string | null> => {
    try {
      if (!recordingInstance) return null;

      await recordingInstance.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = recordingInstance.getURI();
      recordingInstance = null;

      if (!uri) return null;

      const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
      if (!apiKey) {
        console.warn('[VoiceService] Falta la clave EXPO_PUBLIC_GROQ_API_KEY');
        return null;
      }

      const formData = new FormData();
      formData.append('file', {
        uri: uri,
        type: 'audio/m4a',
        name: 'speech.m4a',
      } as any);
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('language', 'es');

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        console.error('[VoiceService] Error en Whisper API:', response.status, await response.text());
        return null;
      }

      const data = await response.json();
      return data.text ? data.text.trim() : null;
    } catch (e) {
      console.error('[VoiceService] Error al detener/transcribir la grabación:', e);
      if (recordingInstance) {
        try {
          await recordingInstance.stopAndUnloadAsync();
        } catch (_) {}
        recordingInstance = null;
      }
      return null;
    }
  },

  stopRecording: async (): Promise<void> => {
    if (recordingInstance) {
      try {
        await recordingInstance.stopAndUnloadAsync();
      } catch (_) {}
      recordingInstance = null;
    }
  },
};
