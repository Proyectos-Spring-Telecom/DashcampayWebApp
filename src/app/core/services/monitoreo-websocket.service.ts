import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthenticationService } from './auth.service';

export interface PositionUpdate {
  id?: number;
  idUnidad?: number;
  idVehiculo?: number;
  latitud: number;
  longitud: number;
  velocidad?: number;
  fechaHora?: string;
  numeroSerieValidador?: string;
  idCliente?: number;
  [key: string]: any;
}

export interface UnidadUpdate {
  id: number;
  codigo?: string;
  modelo?: string;
  conductor?: string;
  ultimoPing?: string;
  velocidad?: string;
  estado?: 'ruta' | 'pausa' | 'desvio';
  desvioKm?: string;
  posicion?: { lat: number; lng: number };
  horaInicioTurno?: string;
  horaFinTurno?: string;
  horaInicioViaje?: string;
  horaFinViaje?: string;
  nombreVariante?: string;
  sumSubidas?: number;
  sumBajadas?: number;
  diferencia?: number;
  [key: string]: any;
}

export interface ConnectedData {
  socketId: string;
  userId?: number;
  cliente?: number;
  rooms?: string[];
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MonitoreoWebSocketService implements OnDestroy {
  private socket: Socket | null = null;
  private isConnectedSubject = new BehaviorSubject<boolean>(false);
  private positionUpdateSubject = new Subject<PositionUpdate>();
  private unidadUpdateSubject = new Subject<UnidadUpdate>();
  private connectedSubject = new Subject<ConnectedData>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000; // 3 segundos
  private reconnectTimer: any = null;
  private isManualDisconnect = false;

  // Observables públicos
  public readonly isConnected$: Observable<boolean> = this.isConnectedSubject.asObservable();
  public readonly positionUpdate$: Observable<PositionUpdate> = this.positionUpdateSubject.asObservable();
  public readonly unidadUpdate$: Observable<UnidadUpdate> = this.unidadUpdateSubject.asObservable();
  public readonly connected$: Observable<ConnectedData> = this.connectedSubject.asObservable();

  constructor(private authService: AuthenticationService) {}

  /**
   * Conecta al servidor WebSocket con autenticación JWT
   */
  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    const token = this.authService.getToken();
    if (!token) {
      console.error('[WebSocket] No hay token disponible. No se puede conectar.');
      return;
    }

    this.isManualDisconnect = false;

    // Socket.IO maneja automáticamente la conversión de HTTP(S) a WS(S).
    // IMPORTANTE: si el API está publicado bajo un prefijo (ej. /apidev),
    // el host/origen y el "path" de Socket.IO deben separarse:
    // - origin: https://dashcampay.com
    // - path:   /apidev/socket.io
    // - namespace: /monitoreo
    const namespace = '/monitoreo';

    const apiBase = environment.API_SECURITY;
    if (!apiBase) {
      console.error('[WebSocket] environment.API_SECURITY no está configurado. No se puede conectar.');
      return;
    }

    const u = new URL(apiBase, window.location.origin);
    const origin = u.origin; // https://dashcampay.com (o http://localhost:3000)
    const basePath = (u.pathname || '/').replace(/\/+$/, ''); // '' | '/apidev'
    const socketPath = `${basePath || ''}/socket.io`; // '/socket.io' | '/apidev/socket.io'

    const wsUrl = `${origin}${namespace}`;

    // Crear conexión Socket.IO con autenticación
    this.socket = io(wsUrl, {
      path: socketPath,
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 10000,
      timeout: 20000
    });

    this.setupEventHandlers();
  }

  /**
   * Configura los manejadores de eventos del socket
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Evento de conexión exitosa
    this.socket.on('connect', () => {
      this.isConnectedSubject.next(true);
      this.reconnectAttempts = 0;
      
      // Suscribirse automáticamente a unidades
      this.subscribeToUnidades();
    });

    // Evento de confirmación de conexión con datos de sesión
    this.socket.on('connected', (data: ConnectedData) => {
      this.connectedSubject.next(data);
    });

    // Evento de actualización de posición
    this.socket.on('position:update', (data: PositionUpdate) => {
      this.positionUpdateSubject.next(data);
    });

    // Evento de actualización de unidad completa
    this.socket.on('unidad:update', (data: UnidadUpdate) => {
      this.unidadUpdateSubject.next(data);
    });

    // Evento de desconexión
    this.socket.on('disconnect', (reason: string) => {
      this.isConnectedSubject.next(false);
      
      // Intentar reconectar solo si no fue una desconexión manual
      if (!this.isManualDisconnect && reason !== 'io client disconnect') {
        this.scheduleReconnect();
      }
    });

    // Evento de error de conexión
    this.socket.on('connect_error', (error: Error) => {
      console.error('[WebSocket] Error de conexión:');
      this.isConnectedSubject.next(false);
      
      // Si el error es de autenticación, no intentar reconectar
      if (error.message.includes('auth') || error.message.includes('token') || error.message.includes('401')) {
        console.error('[WebSocket] Error de autenticación. No se intentará reconectar.');
        this.isManualDisconnect = true;
        return;
      }
      
      if (!this.isManualDisconnect) {
        this.scheduleReconnect();
      }
    });

    // Evento de reconexión
    this.socket.on('reconnect', () => {
      this.reconnectAttempts = 0;
    });

    // Evento de error de reconexión
    this.socket.on('reconnect_error', (error: Error) => {
      console.error('[WebSocket] Error al reconectar:');
      this.reconnectAttempts++;
    });

  }

  /**
   * Programa una reconexión después de un delay
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Máximo de intentos de reconexión alcanzado');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    this.reconnectTimer = setTimeout(() => {
      if (!this.isManualDisconnect && !this.socket?.connected) {
        this.connect();
      }
    }, delay);
  }

  /**
   * Suscribe a actualizaciones de unidades
   */
  subscribeToUnidades(): void {
    if (!this.socket?.connected) {
      console.warn('[WebSocket] No está conectado. No se puede suscribir a unidades.');
      return;
    }

    this.socket.emit('subscribe:unidades');
  }

  /**
   * Desconecta del servidor WebSocket
   */
  disconnect(): void {
    this.isManualDisconnect = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnectedSubject.next(false);
    this.reconnectAttempts = 0;
  }

  /**
   * Verifica si está conectado
   */
  getIsConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Obtiene el ID del socket actual
   */
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  /**
   * Limpia recursos al destruir el servicio
   */
  ngOnDestroy(): void {
    this.disconnect();
    this.positionUpdateSubject.complete();
    this.unidadUpdateSubject.complete();
    this.connectedSubject.complete();
    this.isConnectedSubject.complete();
  }
}
