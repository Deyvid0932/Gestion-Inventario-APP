// src/hooks/useAppInitialization.ts
import { useEffect } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../database/supabase';
import { AuthManager, NetworkService } from '../../services';
import { SynchronizationEngine } from '../../sync/SynchronizationEngine';
import { navigationRef } from '../../navigation/navigationRef';

export function useAppInitialization() {
  const db = useSQLiteContext();
  const loadThemeFromDb = useAppStore(state => state.loadThemeFromDb);
  const setSession = useAppStore(state => state.setSession);
  const setLastSyncTime = useAppStore(state => state.setLastSyncTime);
  const sessionUser = useAppStore(state => state.user);

  // Inicializar servicio de reconexión inteligente de red
  useEffect(() => {
    if (!db) return;
    NetworkService.init(db, sessionUser?.id);
    NetworkService.updateContext(db, sessionUser?.id);

    return () => {
      NetworkService.destroy();
    };
  }, [db, sessionUser?.id]);

  // Inicializar tema y splash
  useEffect(() => {
    if (!db) return;
    loadThemeFromDb(db).finally(() => {
      SplashScreen.hideAsync().catch(() => {});
    });
  }, [db, loadThemeFromDb]);

  // Inicializar autenticación y sync (listener único sin duplicaciones)
  useEffect(() => {
    let lastQueuedUserId: string | null | undefined = undefined;
    let authQueue: Promise<void> = Promise.resolve();

    SynchronizationEngine.getLastSyncTime()
      .then(time => time && setLastSyncTime(time))
      .catch(e => console.error('[SYNC_INIT]', e));

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      const currentId = session?.user?.id ?? null;
      if (db && lastQueuedUserId !== currentId) {
        lastQueuedUserId = currentId;
        authQueue = authQueue
          .then(() => AuthManager.handleAuthChange(db, session?.user ?? null))
          .catch(e => {
            console.error('[AUTH_QUEUE]', e);
            if (lastQueuedUserId === currentId) lastQueuedUserId = undefined;
          });
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [db, setSession, setLastSyncTime]);

  // Mantener SQLite y las pantallas al día cuando otro usuario modifica datos en Supabase.
  useEffect(() => {
    const currentUserId = sessionUser?.id;
    if (!currentUserId || !db) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let isRefreshing = false;
    let refreshPending = false;
    let requiresFullPull = false;
    let lastRefreshStartedAt = 0;
    let wasDisconnected = false;
    let disposed = false;

    const refreshFromCloud = async () => {
      if (disposed || isRefreshing || !refreshPending) return;

      isRefreshing = true;
      refreshPending = false;
      const forceFullPull = requiresFullPull;
      requiresFullPull = false;
      lastRefreshStartedAt = Date.now();
      try {
        const result = await SynchronizationEngine.fullSync(db, currentUserId, true, forceFullPull);
        // El pull puede haber aplicado cambios aunque falle otra tabla o un push pendiente.
        if (!disposed) {
          await AuthManager.refreshAllAppState(db);
        }
        if (!result.success) {
          console.warn('[REALTIME_SYNC] Sincronización incompleta; se actualizaron los datos locales disponibles.');
        }
      } catch (e) {
        console.warn('[REALTIME_SYNC] No se pudo actualizar la copia local:', e);
      } finally {
        isRefreshing = false;
        if (refreshPending && !disposed) {
          scheduleRefresh();
        }
      }
    };

    const scheduleRefresh = (forceFullPull = false) => {
      if (disposed) return;
      refreshPending = true;
      requiresFullPull = requiresFullPull || forceFullPull;
      if (isRefreshing) return;
      if (debounceTimer) return;
      const delay = Math.max(500, 3000 - (Date.now() - lastRefreshStartedAt));
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        refreshFromCloud();
      }, delay);
    };

    const realtimeTables = [
      'inventories',
      'boxes',
      'garments',
      'garment_images',
      'garment_alarms',
    ];

    let channel = supabase.channel(`app_data_sync_${currentUserId}`);
    realtimeTables.forEach(table => {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        payload => {
          if (disposed) return;
          const removedId = (payload.old as { id?: string })?.id;
          if (payload.eventType === 'DELETE' && typeof removedId === 'string' && removedId) {
            SynchronizationEngine.applyRealtimeDeletion(db, table, removedId)
              .catch(error => {
                console.warn('[SYNC_DELETE] No se pudo aplicar el DELETE recibido:', error);
                scheduleRefresh(true);
              });
          } else {
            scheduleRefresh();
          }
        }
      );
    });
    channel.subscribe(status => {
      if (disposed) return;
      if (status === 'SUBSCRIBED' && wasDisconnected) {
        wasDisconnected = false;
        scheduleRefresh(true);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        wasDisconnected = true;
        console.warn(`[REALTIME_SYNC] Canal desconectado (${status}); se recuperarán cambios al reconectar.`);
      }
    });

    return () => {
      disposed = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [db, sessionUser?.id]);

  // Listener en tiempo real: Si un Administrador suspende la cuenta del usuario activo, expulsarlo al instante
  useEffect(() => {
    const currentUserId = sessionUser?.id;
    if (!currentUserId || !db) return;

    const channel = supabase
      .channel(`profile_active_guard_${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${currentUserId}`,
        },
        async (payload) => {
          const newProfile = payload.new as any;
          if (newProfile && (newProfile.active === false || newProfile.activo === false)) {
            console.warn('[REALTIME_AUTH] Cuenta suspendida por Administrador en vivo. Expulsando usuario...');
            useAppStore.getState().setUserProfileAndRoles(newProfile, useAppStore.getState().userRoles, false);
            await SynchronizationEngine.preservePendingInventory(db, currentUserId).catch(() => {});
            await SynchronizationEngine.cleanLocalData(db).catch(() => {});
            await AuthManager.setLastUserId(null).catch(() => {});
            await supabase.auth.signOut().catch(() => {});
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionUser?.id, db]);

  // Listener de notificaciones
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response?.notification?.request?.content?.data;
      const targetBoxId = data?.boxId;
      if (targetBoxId && navigationRef.isReady()) {
        navigationRef.navigate('BoxContents', {
          boxId: targetBoxId as string,
          boxName: (data.boxName as string) || 'Caja',
          targetGarmentId: data.garmentId as string,
        });
      }
    });

    return () => sub.remove();
  }, []);
}
