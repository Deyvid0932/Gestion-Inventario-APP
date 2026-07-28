import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { SQLiteDatabase } from 'expo-sqlite';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (e) {
  console.warn('⚠️ Error al configurar handler de notificaciones:', e);
}

export interface PrendaAlarmItem {
  id: string;
  op: string;
  estilo: string;
  color: string;
  cajaId: string;
  cajaNombre: string;
  alarmaFechaHora: string;
  alarmaNotificationId: string;
}

let isChannelInitialized = false;

const initAndroidChannelIfNeeded = async () => {
  if (Platform.OS === 'android' && !isChannelInitialized) {
    try {
      await Notifications.deleteNotificationChannelAsync('garment-alarms').catch(() => {});
      await Notifications.deleteNotificationChannelAsync('garment-alarms-v2').catch(() => {});
      await Notifications.setNotificationChannelAsync('garment-alarms-v3', {
        name: 'Alarmas de Garment Manager',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500, 250, 500],
        lightColor: '#8b6fd8',
        enableVibrate: true,
        enableLights: true,
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.ALARM,
          contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        },
      });
      isChannelInitialized = true;
    } catch (_) {}
  }
};

export const AlarmService = {
  requestPermissions: async (): Promise<boolean> => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  },

  schedulePrendaAlarm: async (
    prendaId: string,
    cajaId: string,
    cajaNombre: string,
    estilo: string,
    op: string,
    color: string,
    targetDate: Date
  ): Promise<string | null> => {
    try {
      const hasPermission = await AlarmService.requestPermissions();
      if (!hasPermission) {
        console.warn('Permiso de notificaciones denegado.');
        return null;
      }

      const finalTargetDate = new Date(targetDate);
      finalTargetDate.setSeconds(0, 0);

      const now = new Date();
      if (finalTargetDate.getTime() <= now.getTime()) {
        console.warn('La fecha de la alarma debe ser en el futuro.');
        return null;
      }

      await initAndroidChannelIfNeeded();

      const title = `⏰ ALARMA: ${estilo.toUpperCase()}`;
      const body = `OP: ${op || 'Sin OP'} | Color: ${color || 'N/A'} - Caja: ${cajaNombre || 'Caja'}`;

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          data: { prendaId, cajaId, cajaNombre, estilo, op, color },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: finalTargetDate,
          channelId: 'garment-alarms-v3',
        },
      });

      return notificationId;
    } catch (e) {
      console.error('Error al programar la alarma:', e);
      return null;
    }
  },

  cancelPrendaAlarm: async (notificationId: string): Promise<void> => {
    try {
      if (notificationId) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
      }
    } catch (e) {
      console.error('Error al cancelar la alarma:', e);
    }
  },

  getActiveAlarms: async (db: SQLiteDatabase): Promise<PrendaAlarmItem[]> => {
    try {
      return await db.getAllAsync<PrendaAlarmItem>(`
        SELECT p.id, p.op, p.estilo, p.color, p.cajaId, c.nombre as cajaNombre, p.alarmaFechaHora, p.alarmaNotificationId
        FROM prendas p
        JOIN cajas c ON p.cajaId = c.id
        WHERE p.alarmaFechaHora IS NOT NULL
        ORDER BY p.alarmaFechaHora ASC
      `);
    } catch (e) {
      console.error('Error al obtener alarmas activas:', e);
      return [];
    }
  }
};
