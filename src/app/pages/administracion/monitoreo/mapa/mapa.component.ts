// mapa.component.ts
import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { MonitoreoWebSocketService, PositionUpdate, UnidadUpdate } from 'src/app/core/services/monitoreo-websocket.service';
import { Subscription } from 'rxjs';
import { VariantesService } from 'src/app/pages/services/variantes.service';
import { RutasService } from 'src/app/pages/services/ruta.service';
import { ZonasService } from 'src/app/pages/services/zonas.service';
import { TalleresService } from 'src/app/pages/services/talleres.service';

declare const google: any;

interface UnidadMapa {
  id: number;
  codigo: string;        // U-143, U-092, etc.
  modelo: string;        // Boxer 2022, Worker 15.190...
  conductor: string;
  ultimoPing: string;    // "08:14"
  velocidad?: string;    // "67 km/h"
  estado: 'ruta' | 'pausa' | 'desvio';
  desvioKm?: string;     // "3.1 km"
  posicion: { lat: any; lng: any };
  horaInicioTurno?: string;
  horaFinTurno?: string;
  horaInicioViaje?: string;
  horaFinViaje?: string;
  nombreVariante?: string;
  sumSubidas?: number;   // Ascensos
  sumBajadas?: number;    // Descensos
  diferencia?: number;    // Diferencia
  numeroSerieValidador?: string; // Número de serie del validador para identificar la unidad
}

@Component({
  selector: 'vex-mapa',
  templateUrl: './mapa.component.html',
  styleUrls: ['./mapa.component.scss'],
  animations: [fadeInRight400ms],
})
export class MapaComponent implements OnInit, AfterViewInit, OnDestroy {
  private map!: google.maps.Map;
  private infoWindow!: google.maps.InfoWindow;
  private markers = new Map<number, google.maps.Marker>();
  private activeInfoWindowUnitId: number | null = null; // ID de la unidad cuyo InfoWindow está abierto
  layoutCtrl = new UntypedFormControl('fullwidth');
  private mapaInicializado = false;
  private websocketSubscriptions: Subscription[] = [];

  // Polylines y marcadores para rutas/variantes
  private routePolyline: google.maps.Polyline | null = null;
  private routeStartMarker: google.maps.Marker | null = null;
  private routeEndMarker: google.maps.Marker | null = null;

  // Recorrido (track del vehículo desde API /monitoreo/recorrido)
  private recorridoPolyline: google.maps.Polyline | null = null;
  private recorridoStartMarker: google.maps.Marker | null = null;
  private recorridoEndMarker: google.maps.Marker | null = null;
  private recorridoDots: google.maps.Circle[] = [];

  // Polígono para zonas
  private zonaPolygon: google.maps.Polygon | null = null;

  // Marcador de taller seleccionado
  private tallerMarker: google.maps.Marker | null = null;

  private readonly MAP_ID = 'DEMO_MAP_ID';

  constructor(
    private http: HttpClient,
    private monitoreoWebSocket: MonitoreoWebSocketService,
    private variantesService: VariantesService,
    private rutasService: RutasService,
    private zonasService: ZonasService,
    private talleresService: TalleresService
  ) {}

  unidades: UnidadMapa[] = [];
  loadingUnidades = false;
  isWebSocketConnected = false;
  
  // Selects de filtros
  listaVariantes: any[] = [];
  listaRutas: any[] = [];
  listaZonas: any[] = [];
  listaTalleres: any[] = [];
  varianteControl = new UntypedFormControl(null);
  rutaControl = new UntypedFormControl(null);
  zonaControl = new UntypedFormControl(null);
  tallerControl = new UntypedFormControl(null);

  ngOnInit(): void {
    this.obtenerMonitoreo();
    this.initWebSocket();
    this.cargarVariantes();
    this.cargarRutas();
    this.cargarZonas();
    this.cargarTalleres();

    // Suscribirse a cambios en los selects
    this.varianteControl.valueChanges.subscribe((idVariante) => {
      if (idVariante) {
        this.limpiarZona();
        this.dibujarVariante(idVariante);
      } else {
        this.limpiarRutaVariante();
      }
    });

    this.rutaControl.valueChanges.subscribe((idRuta) => {
      if (idRuta) {
        this.limpiarZona();
        this.dibujarRuta(idRuta);
      } else {
        this.limpiarRutaVariante();
      }
    });

    this.zonaControl.valueChanges.subscribe((idZona) => {
      if (idZona) {
        this.limpiarRutaVariante();
        this.dibujarZona(idZona);
      } else {
        this.limpiarZona();
      }
    });

    this.tallerControl.valueChanges.subscribe((idTaller) => {
      if (idTaller) {
        this.dibujarTaller(idTaller);
      } else {
        this.limpiarTallerMarker();
      }
    });
  }

  /**
   * Carga la lista de variantes
   */
  cargarVariantes(): void {
    this.variantesService.obtenerVariantes().subscribe({
      next: (response: any) => {
        this.listaVariantes = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
      },
      error: (error) => {
        console.error('Error al cargar variantes:');
        this.listaVariantes = [];
      }
    });
  }

  /**
   * Carga la lista de rutas
   */
  cargarRutas(): void {
    this.rutasService.obtenerRutas().subscribe({
      next: (response: any) => {
        this.listaRutas = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
      },
      error: (error) => {
        console.error('Error al cargar rutas:');
        this.listaRutas = [];
      }
    });
  }

  /**
   * Carga la lista de zonas
   */
  cargarZonas(): void {
    this.zonasService.obtenerZonas().subscribe({
      next: (response: any) => {
        this.listaZonas = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
      },
      error: (error) => {
        console.error('Error al cargar zonas:');
        this.listaZonas = [];
      }
    });
  }

  /**
   * Carga la lista de talleres desde /talleres/list
   */
  cargarTalleres(): void {
    this.talleresService.obtenerTalleres().subscribe({
      next: (response: any) => {
        const raw = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
        this.listaTalleres = raw.map((t: any) => ({
          ...t,
          id: Number(t?.id ?? t?.Id ?? t?.ID)
        }));
      },
      error: (error) => {
        console.error('Error al cargar talleres:');
        this.listaTalleres = [];
      }
    });
  }

  /**
   * Inicializa la conexión WebSocket y suscripciones
   */
  private initWebSocket(): void {
    // Conectar al WebSocket
    this.monitoreoWebSocket.connect();

    // Suscribirse al estado de conexión
    const connectionSub = this.monitoreoWebSocket.isConnected$.subscribe(
      (connected: boolean) => {
        this.isWebSocketConnected = connected;
      }
    );
    this.websocketSubscriptions.push(connectionSub);

    // Suscribirse a actualizaciones de posición
    const positionSub = this.monitoreoWebSocket.positionUpdate$.subscribe(
      (update: PositionUpdate) => {
        this.handlePositionUpdate(update);
      }
    );
    this.websocketSubscriptions.push(positionSub);

    // Suscribirse a actualizaciones de unidad completa
    const unidadSub = this.monitoreoWebSocket.unidadUpdate$.subscribe(
      (update: UnidadUpdate) => {
        this.handleUnidadUpdate(update);
      }
    );
    this.websocketSubscriptions.push(unidadSub);
  }

  /**
   * Maneja actualizaciones de posición recibidas por WebSocket
   */
  private handlePositionUpdate(update: PositionUpdate): void {
    if (!this.mapaInicializado || !this.map) {
      return;
    }

    const unidadId = update.idUnidad || update.idVehiculo || update.id;
    const numeroSerieValidador = update.numeroSerieValidador;

    // Extraer coordenadas: puede venir como latitud/longitud directas o en objeto posicion
    let lat: number;
    let lng: number;
    
    const posicionObj = update['posicion'];
    if (posicionObj && typeof posicionObj === 'object' && 'lat' in posicionObj && 'lng' in posicionObj) {
      // Si viene en objeto posicion
      lat = Number((posicionObj as any).lat);
      lng = Number((posicionObj as any).lng);
    } else if (update.latitud !== undefined && update.longitud !== undefined) {
      // Si viene como latitud/longitud directas
      lat = Number(update.latitud);
      lng = Number(update.longitud);
    } else {
      console.warn('[MapaComponent] Actualización de posición sin coordenadas válidas:', update);
      return;
    }

    // Validar que las coordenadas sean números válidos
    if (!this.coordenadaEnMapa(lat, lng)) {
      return;
    }

    // Buscar la unidad existente primero por ID, luego por número de serie del validador
    let unidad: UnidadMapa | undefined;

    if (unidadId) {
      unidad = this.unidades.find(u => u.id === unidadId);
    }

    // Si no se encontró por ID y tenemos número de serie del validador, buscar por ese campo
    if (!unidad && numeroSerieValidador) {
      unidad = this.unidades.find(u => 
        u.numeroSerieValidador && 
        u.numeroSerieValidador.toString().toLowerCase() === numeroSerieValidador.toString().toLowerCase()
      );
    }

    if (unidad) {
      unidad.posicion = {
        lat: lat,
        lng: lng
      };

      if (update.velocidad !== undefined) {
        unidad.velocidad = `${update.velocidad} km/h`;
      }

      if (update.fechaHora) {
        try {
          const fecha = new Date(update.fechaHora);
          unidad.ultimoPing = fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
          console.error('[MapaComponent] Error al formatear fecha:');
        }
      }

      // Actualizar marcador en el mapa
      this.updateMarker(unidad);
    } else {
      // Si no existe la unidad, podría ser una nueva unidad
      // En este caso, recargar todas las unidades o agregar la nueva
      console.warn('[MapaComponent] Unidad no encontrada en el mapa. ID:', unidadId, 'Número serie validador:', numeroSerieValidador);
      this.obtenerMonitoreo();
    }
  }

  /**
   * Maneja actualizaciones completas de unidad recibidas por WebSocket
   */
  private handleUnidadUpdate(update: UnidadUpdate): void {
    if (!this.mapaInicializado || !this.map) {
      return;
    }

    // Mapear la actualización a la estructura UnidadMapa
    const unidadMapeada: UnidadMapa = {
      id: update.id,
      codigo: update.codigo || `U-${update.id}`,
      modelo: update.modelo || '',
      conductor: update.conductor || '',
      ultimoPing: update.ultimoPing || '',
      velocidad: update.velocidad,
      estado: update.estado || 'ruta',
      desvioKm: update.desvioKm,
      posicion: update.posicion || { lat: 19.432608, lng: -99.133209 },
      horaInicioTurno: update.horaInicioTurno,
      horaFinTurno: update.horaFinTurno,
      horaInicioViaje: update.horaInicioViaje,
      horaFinViaje: update.horaFinViaje,
      nombreVariante: update.nombreVariante,
      sumSubidas: update.sumSubidas,
      sumBajadas: update.sumBajadas,
      diferencia: update.diferencia
    };

    // Buscar si la unidad ya existe
    const index = this.unidades.findIndex(u => u.id === unidadMapeada.id);

    if (index >= 0) {
      // Actualizar unidad existente
      this.unidades[index] = unidadMapeada;
      this.updateMarker(unidadMapeada);
    } else {
      // Agregar nueva unidad
      this.unidades.push(unidadMapeada);
      this.addMarker(unidadMapeada);
    }
  }

  /**
   * Actualiza un marcador existente en el mapa
   */
  private updateMarker(unidad: UnidadMapa): void {
    const marker = this.markers.get(unidad.id);
    
    if (marker) {
      // Validar coordenadas antes de actualizar
      const lat = Number(unidad.posicion.lat);
      const lng = Number(unidad.posicion.lng);
      
      if (isNaN(lat) || isNaN(lng)) {
        console.error(`[MapaComponent] Coordenadas inválidas para unidad ${unidad.id}:`, unidad.posicion);
        return;
      }

      // Obtener posición actual del marcador para comparar
      const currentPosition = marker.getPosition();
      const nuevaPosicion = new google.maps.LatLng(lat, lng);
      
      // Actualizar posición del marcador solo si cambió
      if (!currentPosition || 
          currentPosition.lat() !== lat || 
          currentPosition.lng() !== lng) {
        marker.setPosition(nuevaPosicion);
      }
      
      // Actualizar título
      marker.setTitle(`${unidad.codigo} · ${unidad.modelo}`);

      // Si el infoWindow está abierto para este marcador, actualizar su contenido
      if (this.infoWindow && this.activeInfoWindowUnitId === unidad.id && marker.getMap()) {
        const html = this.buildInfoWindowHtml(unidad);
        this.infoWindow.setContent(html);
      }
    } else {
      // Si no existe el marcador, crearlo
      this.addMarker(unidad);
    }
  }

  private coordenadaEnMapa(lat: number, lng: number): boolean {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
    if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return false;
    return true;
  }

  obtenerMonitoreo(): void {
    this.loadingUnidades = true;
    this.http.get(`${environment.API_SECURITY}/monitoreo`).subscribe({
      next: (result: any) => {
        
        // Mapear la respuesta del API a la estructura UnidadMapa
        const datos = Array.isArray(result?.data) ? result.data : (Array.isArray(result) ? result : []);
        
        this.unidades = datos.map((item: any) => {
          const pos = item.posicion || {};
          const lat = Number(pos.latitud ?? pos.lat ?? item.latitud);
          const lng = Number(pos.longitud ?? pos.lng ?? item.longitud);
          if (!this.coordenadaEnMapa(lat, lng)) return null;
          
          // Mapear estado
          let estado: 'ruta' | 'pausa' | 'desvio' = 'ruta';
          const estadoStr = (item.estado || item.estatus || '').toString().toLowerCase();
          if (estadoStr.includes('pausa') || estadoStr === 'pausa') {
            estado = 'pausa';
          } else if (estadoStr.includes('desvio') || estadoStr.includes('fuera')) {
            estado = 'desvio';
          }
          
          // Formatear último ping
          let ultimoPing = '';
          if (item.ultimoPing) {
            ultimoPing = item.ultimoPing;
          } else if (item.fechaHora || item.fechaHoraFinal || item.fechaHoraInicial) {
            const fecha = new Date(item.fechaHora || item.fechaHoraFinal || item.fechaHoraInicial);
            ultimoPing = fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
          }
          
          // Función helper para formatear horas
          const formatearHora = (fecha: any): string | undefined => {
            if (!fecha) return undefined;
            try {
              const date = new Date(fecha);
              if (isNaN(date.getTime())) return undefined;
              return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
            } catch {
              return undefined;
            }
          };
          
          return {
            id: item.id || item.idVehiculo || item.idUnidad || 0,
            codigo: item.codigo || item.numeroEconomico || `U-${item.id || ''}`,
            modelo: item.modelo || item.modeloVehiculo || '',
            conductor: item.conductor || item.nombreConductor || item.operador || '',
            ultimoPing: ultimoPing,
            velocidad: item.velocidad || undefined,
            estado: estado,
            desvioKm: item.desvioKm || item.desvio ? `${item.desvioKm || item.desvio} km` : undefined,
            posicion: { lat: Number(lat), lng: Number(lng) },
            horaInicioTurno: formatearHora(item.turnoInicio),
            horaFinTurno: formatearHora(item.turnoFin),
            horaInicioViaje: formatearHora(item.viajeInicio),
            horaFinViaje: formatearHora(item.viajeFin),
            nombreVariante: item.nombreVariante || undefined,
            sumSubidas: item.sumSubidas !== undefined ? Number(item.sumSubidas) : undefined,
            sumBajadas: item.sumBajadas !== undefined ? Number(item.sumBajadas) : undefined,
            diferencia: item.diferencia !== undefined ? Number(item.diferencia) : undefined,
            numeroSerieValidador: item.numeroSerieValidador || item.numeroSerie || item.validador?.numeroSerie || item.validador?.numeroSerieValidador || undefined
          };
        }).filter((unidad: any) => unidad != null);
        
        this.loadingUnidades = false;
        
        // Si el mapa ya está inicializado, actualizar los marcadores
        if (this.mapaInicializado && this.map) {
          this.actualizarMarcadores();
        }
      },
      error: (err: any) => {
        console.error('Error al obtener /monitoreo:');
        this.loadingUnidades = false;
      }
    });
  }

  /**
   * Ejecuta el API de recorrido para la unidad seleccionada (POST /monitoreo/recorrido).
   */
  ejecutarRecorrido(unidad: UnidadMapa): void {
    const numeroSerieValidador = unidad?.numeroSerieValidador?.trim?.() || unidad?.numeroSerieValidador;
    if (!numeroSerieValidador) {
      console.warn('[MapaComponent] No hay numeroSerieValidador para esta unidad.');
      return;
    }
    this.http.post(`${environment.API_SECURITY}/monitoreo/recorrido`, { NumeroSerieValidador: numeroSerieValidador }).subscribe({
      next: (res: any) => {
        const puntos = Array.isArray(res?.posicion)
          ? res.posicion
          : Array.isArray(res)
            ? res
            : Array.isArray(res?.data)
              ? res.data
              : [];
        if (puntos.length > 0 && this.mapaInicializado && this.map) {
          this.dibujarRecorrido(puntos);
        }
      },
      error: (err: any) => {
        console.error('[MapaComponent] Error al ejecutar recorrido:');
      }
    });
  }

  /**
   * Dibuja en el mapa el recorrido (array de puntos con latitud, longitud).
   */
  private dibujarRecorrido(puntos: Array<{ latitud: number; longitud: number; [key: string]: any }>): void {
    this.limpiarRecorrido();
    const path = puntos
      .map((p) => ({
        lat: Number(p.latitud ?? p['lat']),
        lng: Number(p.longitud ?? p['lng']),
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (path.length === 0) return;
    const inicio = path[0];
    const fin = path[path.length - 1];

    if (path.length >= 2) {
      // Línea que une todas las posiciones del recorrido
      this.recorridoPolyline = new google.maps.Polyline({
        map: this.map!,
        path,
        strokeColor: '#0A2E57',
        strokeOpacity: 0.9,
        strokeWeight: 5,
        zIndex: 1,
        icons: [{
          icon: {
            path: 'M 0,-1 0,1',
            strokeColor: '#0A2E57',
            strokeOpacity: 0.9,
            strokeWeight: 2,
            scale: 4,
          },
          repeat: '14px',
        }],
      });

      const step = path.length > 120 ? Math.max(1, Math.floor(path.length / 80)) : 1;
      const pathParaPuntos = step === 1 ? path : path.filter((_, i) => i % step === 0 || i === path.length - 1);
      for (const p of pathParaPuntos) {
        const circle = new google.maps.Circle({
          map: this.map!,
          center: p,
          radius: 6,
          fillColor: '#1F5AA8',
          fillOpacity: 0.9,
          strokeColor: '#0A2E57',
          strokeWeight: 1,
          zIndex: 2,
        });
        this.recorridoDots.push(circle);
      }

      this.recorridoStartMarker = new google.maps.Marker({
        map: this.map!,
        position: inicio,
        title: 'Inicio recorrido',
        icon: {
          url: this.svgPinUrl('#16a34a'),
          scaledSize: new google.maps.Size(40, 40),
          anchor: new google.maps.Point(20, 38),
        },
        zIndex: 3,
      });

      this.recorridoEndMarker = new google.maps.Marker({
        map: this.map!,
        position: fin,
        title: 'Fin recorrido',
        icon: {
          url: this.svgPinUrl('#ef4444'),
          scaledSize: new google.maps.Size(40, 40),
          anchor: new google.maps.Point(20, 38),
        },
        zIndex: 3,
      });
    } else {
      // Un solo punto: marcador discreto
      const circle = new google.maps.Circle({
        map: this.map!,
        center: inicio,
        radius: 10,
        fillColor: '#1F5AA8',
        fillOpacity: 0.18,
        strokeColor: '#0A2E57',
        strokeWeight: 1,
        zIndex: 2,
      });
      this.recorridoDots.push(circle);
      this.recorridoStartMarker = new google.maps.Marker({
        map: this.map!,
        position: inicio,
        title: 'Posición actual',
        icon: {
          url: this.svgPinUrl('#1F5AA8'),
          scaledSize: new google.maps.Size(26, 26),
          anchor: new google.maps.Point(13, 26),
        },
        zIndex: 3,
      });
    }

    const bounds = new google.maps.LatLngBounds();
    path.forEach((p) => bounds.extend(p));
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    if (ne.lat() - sw.lat() < 1e-5 || ne.lng() - sw.lng() < 1e-5) {
      bounds.extend({ lat: sw.lat() - 0.002, lng: sw.lng() - 0.002 });
      bounds.extend({ lat: ne.lat() + 0.002, lng: ne.lng() + 0.002 });
    }
    this.map!.fitBounds(bounds, { top: 80, bottom: 80, left: 80, right: 80 });
    setTimeout(() => {
      if (this.map && bounds.getNorthEast() && bounds.getSouthWest()) {
        this.map.fitBounds(bounds, { top: 80, bottom: 80, left: 80, right: 80 });
      }
    }, 100);
  }

  /**
   * Limpia el recorrido dibujado en el mapa.
   */
  private limpiarRecorrido(): void {
    if (this.recorridoPolyline) {
      this.recorridoPolyline.setMap(null);
      this.recorridoPolyline = null;
    }
    this.recorridoDots.forEach((c) => c.setMap(null));
    this.recorridoDots = [];
    if (this.recorridoStartMarker) {
      this.recorridoStartMarker.setMap(null);
      this.recorridoStartMarker = null;
    }
    if (this.recorridoEndMarker) {
      this.recorridoEndMarker.setMap(null);
      this.recorridoEndMarker = null;
    }
  }

  private actualizarMarcadores(): void {
    // Limpiar marcadores existentes
    this.markers.forEach((marker) => marker.setMap(null));
    this.markers.clear();
    
    // Agregar nuevos marcadores
    this.unidades.forEach((u) => this.addMarker(u));
    
    // Ajustar el centro del mapa si hay unidades
    if (this.unidades.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      this.unidades.forEach((u) => {
        bounds.extend(new google.maps.LatLng(u.posicion.lat, u.posicion.lng));
      });
      this.map.fitBounds(bounds);
    }
  }

  async ngAfterViewInit(): Promise<void> {
    try {
      await this.waitForGoogleMaps();
      this.initMap();
    } catch (e) {
      console.error('Google Maps no cargó');
    }
  }

  ngOnDestroy(): void {
    // Limpiar marcadores
    this.markers.forEach((m) => m.setMap(null));
    this.markers.clear();

    // Limpiar rutas/variantes dibujadas
    this.limpiarRutaVariante();

    // Limpiar zona dibujada
    this.limpiarZona();

    // Limpiar marcador de taller
    this.limpiarTallerMarker();

    // Limpiar recorrido
    this.limpiarRecorrido();

    // Desconectar WebSocket y limpiar suscripciones
    this.monitoreoWebSocket.disconnect();
    this.websocketSubscriptions.forEach(sub => sub.unsubscribe());
    this.websocketSubscriptions = [];
  }

  private waitForGoogleMaps(): Promise<void> {
    if ((window as any).google?.maps) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        if ((window as any).google?.maps) return resolve();
        if (Date.now() - start > 8000) return reject('Timeout Google Maps');
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  private initMap(): void {
    const el = document.getElementById('map');
    if (!el) {
      console.error('No se encontró el elemento #map');
      return;
    }
    el.innerHTML = '';

    const options: google.maps.MapOptions = {
      center: { lat: 19.432608, lng: -99.133209 },
      zoom: 8,
      fullscreenControl: true,
      streetViewControl: false,
      mapTypeControl: true,
      mapId: this.MAP_ID,
      clickableIcons: false,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        },
        {
          featureType: 'poi',
          stylers: [{ visibility: 'off' }]
        }
      ]
    };

    this.map = new google.maps.Map(el, options);
    this.infoWindow = new google.maps.InfoWindow();
    this.mapaInicializado = true;

    this.map.addListener('click', () => {
      this.infoWindow.close();
      this.activeInfoWindowUnitId = null; // Limpiar referencia cuando se cierra el InfoWindow
    });

    // Si ya hay unidades cargadas, agregar marcadores
    if (this.unidades.length > 0) {
      this.actualizarMarcadores();
    }
  }

private addMarker(u: UnidadMapa): void {
  const icon = {
    url: this.svgCarUrl('#1F5AA8'), // azul medio de tu manual
    scaledSize: new google.maps.Size(42, 42),
    anchor: new google.maps.Point(21, 36),
  };

  const marker = new google.maps.Marker({
    position: u.posicion,
    map: this.map,
    title: `${u.codigo} · ${u.modelo}`,
    icon,
  });

  marker.addListener('click', (ev: any) => {
    if (ev?.domEvent?.stopPropagation) {
      ev.domEvent.stopPropagation();
    }

    const html = this.buildInfoWindowHtml(u);
    this.infoWindow.setContent(html);
    this.infoWindow.open(this.map, marker);
    this.activeInfoWindowUnitId = u.id; // Guardar referencia al marcador activo
  });

  this.markers.set(u.id, marker);
}


  private buildInfoWindowHtml(u: UnidadMapa): string {
    const estadoTexto =
      u.estado === 'ruta'
        ? 'En ruta'
        : u.estado === 'pausa'
        ? 'En pausa'
        : 'Fuera de ruta';

    const estadoColor =
      u.estado === 'ruta'
        ? '#22c55e'
        : u.estado === 'pausa'
        ? '#fbbf24'
        : '#ef4444';

    return `
      <div class="mp-iw">
        <div class="mp-iw-title">
          ${u.codigo} · ${u.modelo}
        </div>
        <div class="mp-iw-row">
          <span class="mp-iw-label">Conductor</span>
          <span class="mp-iw-value">${u.conductor}</span>
        </div>
        <div class="mp-iw-row">
          <span class="mp-iw-label">Último ping</span>
          <span class="mp-iw-value">${u.ultimoPing}</span>
        </div>
        ${
          u.velocidad
            ? `<div class="mp-iw-row">
                 <span class="mp-iw-label">Velocidad</span>
                 <span class="mp-iw-value">${u.velocidad}</span>
               </div>`
            : ''
        }
        ${
          u.desvioKm
            ? `<div class="mp-iw-row">
                 <span class="mp-iw-label">Desvío</span>
                 <span class="mp-iw-value">${u.desvioKm}</span>
               </div>`
            : ''
        }
        ${
          u.sumSubidas !== undefined
            ? `<div class="mp-iw-row">
                 <span class="mp-iw-label">Ascensos</span>
                 <span class="mp-iw-value">${u.sumSubidas}</span>
               </div>`
            : ''
        }
        ${
          u.sumBajadas !== undefined
            ? `<div class="mp-iw-row">
                 <span class="mp-iw-label">Descensos</span>
                 <span class="mp-iw-value">${u.sumBajadas}</span>
               </div>`
            : ''
        }
        ${
          u.diferencia !== undefined
            ? `<div class="mp-iw-row">
                 <span class="mp-iw-label">Diferencia</span>
                 <span class="mp-iw-value">${u.diferencia}</span>
               </div>`
            : ''
        }
        <div class="mp-iw-pill" style="background:${estadoColor}1a;color:${estadoColor}">
          ${estadoTexto}
        </div>
      </div>
    `;
  }

  centrarUnidad(id: number): void {
    const marker = this.markers.get(id);
    const unidad = this.unidades.find((u) => u.id === id);

    if (!marker || !unidad) return;

    const pos = marker.getPosition();
    if (!pos) return;

    this.map.panTo(pos);
    this.map.setZoom(14);

    const html = this.buildInfoWindowHtml(unidad);
    this.infoWindow.setContent(html);
    this.infoWindow.open(this.map, marker);
    this.activeInfoWindowUnitId = id; // Guardar referencia al marcador activo
  }

  private svgCarUrl(color: string) {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">
    <g fill="none" fill-rule="evenodd">
      <path d="M3 13.5c0-.8.5-1.5 1.2-1.7l1-.3 1.3-3.5C6.9 7 7.7 6.5 8.6 6.5h6.8c.9 0 1.7.5 2.1 1.5l1.3 3.5 1 .3c.7.2 1.2.9 1.2 1.7V16c0 .6-.4 1-1 1h-1v1.2c0 .4-.3.8-.8.8h-1c-.4 0-.8-.3-.8-.8V17H7.3v1.2c0 .4-.3.8-.8.8h-1c-.4 0-.8-.3-.8-.8V17H3c-.6 0-1-.4-1-1v-2.5Z" fill="${color}"/>
      <circle cx="7.5" cy="15.5" r="1.3" fill="#ffffff"/>
      <circle cx="16.5" cy="15.5" r="1.3" fill="#ffffff"/>
      <rect x="8" y="8" width="8" height="3" rx=".7" fill="#ffffff" opacity=".9"/>
    </g>
  </svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

  /**
   * Crea un SVG para marcador de pin
   */
  private svgPinUrl(color: string): string {
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">
      <path d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z" fill="${color}"/>
      <circle cx="12" cy="9" r="3" fill="#ffffff"/>
    </svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  /**
   * Lee coordenadas de diferentes formatos
   */
  private readLatLng(obj: any): { lat: number; lng: number } | null {
    if (!obj) return null;
    if (obj.lat !== undefined && obj.lng !== undefined) {
      return { lat: Number(obj.lat), lng: Number(obj.lng) };
    }
    if (obj.latitud !== undefined && obj.longitud !== undefined) {
      return { lat: Number(obj.latitud), lng: Number(obj.longitud) };
    }
    if (obj.coordenadas?.lat !== undefined && obj.coordenadas?.lng !== undefined) {
      return { lat: Number(obj.coordenadas.lat), lng: Number(obj.coordenadas.lng) };
    }
    return null;
  }

  /**
   * Dibuja una variante en el mapa
   */
  dibujarVariante(idVariante: number): void {
    if (!this.mapaInicializado || !this.map) {
      console.warn('[MapaComponent] Mapa no inicializado, esperando...');
      setTimeout(() => this.dibujarVariante(idVariante), 500);
      return;
    }

    // Limpiar ruta si hay una seleccionada
    if (this.rutaControl.value) {
      this.rutaControl.setValue(null, { emitEvent: false });
    }

    this.variantesService.obtenerVariante(idVariante).subscribe({
      next: (response: any) => {
        // La respuesta puede venir como objeto directo o como array en data
        let variante: any;
        if (Array.isArray(response?.data)) {
          // Si es un array, buscar la variante por ID o tomar la primera
          variante = response.data.find((v: any) => v.id === idVariante) || response.data[0];
        } else {
          variante = response?.data || response;
        }

        if (!variante) {
          console.error('[MapaComponent] Variante no encontrada');
          return;
        }

        // Obtener coordenadas de inicio y fin - probar diferentes formatos
        let inicio = this.readLatLng(variante?.puntoInicio?.coordenadas);
        if (!inicio) {
          inicio = this.readLatLng(variante?.puntoInicio);
        }
        if (!inicio && variante?.puntoInicio) {
          // Intentar leer directamente si tiene lat/lng
          inicio = { lat: variante.puntoInicio.lat, lng: variante.puntoInicio.lng };
        }

        let fin = this.readLatLng(variante?.puntoFin?.coordenadas);
        if (!fin) {
          fin = this.readLatLng(variante?.puntoFin);
        }
        if (!fin && variante?.puntoFin) {
          // Intentar leer directamente si tiene lat/lng
          fin = { lat: variante.puntoFin.lat, lng: variante.puntoFin.lng };
        }

        if (!inicio || !fin) {
          console.error('[MapaComponent] Variante sin coordenadas válidas', {
            puntoInicio: variante?.puntoInicio,
            puntoFin: variante?.puntoFin,
            inicio,
            fin
          });
          return;
        }

        // Obtener recorrido detallado
        const recorrido: Array<{ lat: number; lng: number; nombre?: string }> = Array.isArray(variante?.recorridoDetallado)
          ? variante.recorridoDetallado
              .map((p: any) => {
                const punto = this.readLatLng(p) || (p?.lat !== undefined && p?.lng !== undefined ? { lat: Number(p.lat), lng: Number(p.lng) } : null);
                if (!punto) return null;
                const nombre = p?.nombre ? String(p.nombre).trim() : undefined;
                return nombre ? { ...punto, nombre } : punto;
              })
              .filter((p: any): p is { lat: number; lng: number; nombre?: string } => !!p)
          : [];

        this.dibujarRutaEnMapa(inicio, fin, recorrido);
      },
      error: (error) => {
        console.error('[MapaComponent] Error al obtener variante:');
      }
    });
  }

  /**
   * Dibuja una ruta en el mapa
   */
  dibujarRuta(idRuta: number): void {
    if (!this.mapaInicializado || !this.map) {
      console.warn('[MapaComponent] Mapa no inicializado, esperando...');
      setTimeout(() => this.dibujarRuta(idRuta), 500);
      return;
    }

    // Limpiar variante si hay una seleccionada
    if (this.varianteControl.value) {
      this.varianteControl.setValue(null, { emitEvent: false });
    }

    this.rutasService.obtenerRuta(idRuta).subscribe({
      next: (response: any) => {
        // La respuesta puede venir como objeto directo o como array en data
        let ruta: any;
        if (Array.isArray(response?.data)) {
          // Si es un array, buscar la ruta por ID o tomar la primera
          ruta = response.data.find((r: any) => r.id === idRuta) || response.data[0];
        } else {
          ruta = response?.data || response;
        }

        if (!ruta) {
          console.error('[MapaComponent] Ruta no encontrada');
          return;
        }

        // Obtener coordenadas de inicio y fin - probar diferentes formatos
        let inicio = this.readLatLng(ruta?.inicio);
        if (!inicio) {
          inicio = this.readLatLng(ruta?.puntoInicio?.coordenadas) || this.readLatLng(ruta?.puntoInicio);
        }
        if (!inicio && ruta?.puntoInicio) {
          // Intentar leer directamente si tiene lat/lng
          inicio = { lat: ruta.puntoInicio.lat, lng: ruta.puntoInicio.lng };
        }

        let fin = this.readLatLng(ruta?.fin);
        if (!fin) {
          fin = this.readLatLng(ruta?.puntoFin?.coordenadas) || this.readLatLng(ruta?.puntoFin);
        }
        if (!fin && ruta?.puntoFin) {
          // Intentar leer directamente si tiene lat/lng
          fin = { lat: ruta.puntoFin.lat, lng: ruta.puntoFin.lng };
        }

        if (!inicio || !fin) {
          console.error('[MapaComponent] Ruta sin coordenadas válidas', {
            inicio: ruta?.inicio,
            fin: ruta?.fin,
            puntoInicio: ruta?.puntoInicio,
            puntoFin: ruta?.puntoFin,
            inicioLeido: inicio,
            finLeido: fin
          });
          return;
        }

        // Las rutas no tienen recorrido detallado, solo inicio y fin
        this.dibujarRutaEnMapa(inicio, fin, []);
      },
      error: (error) => {
        console.error('[MapaComponent] Error al obtener ruta:');
      }
    });
  }

  /**
   * Dibuja la ruta/variante en el mapa
   */
  private dibujarRutaEnMapa(
    inicio: { lat: number; lng: number },
    fin: { lat: number; lng: number },
    recorrido: Array<{ lat: number; lng: number; nombre?: string }> = []
  ): void {
    if (!this.map) return;

    // Limpiar dibujos anteriores
    this.limpiarRutaVariante();

    // Crear path: usar recorrido si existe, sino línea directa inicio-fin
    const path: Array<{ lat: number; lng: number }> = 
      (Array.isArray(recorrido) && recorrido.length > 0) 
        ? recorrido.map(p => ({ lat: p.lat, lng: p.lng }))
        : [inicio, fin];

    // Dibujar polyline
    this.routePolyline = new google.maps.Polyline({
      map: this.map,
      path: path,
      strokeColor: '#1F5AA8',
      strokeOpacity: 0.95,
      strokeWeight: 4,
      zIndex: 1
    });

    // Crear marcadores de inicio y fin
    this.routeStartMarker = new google.maps.Marker({
      map: this.map,
      position: inicio,
      title: 'Inicio',
      icon: {
        url: this.svgPinUrl('#16a34a'),
        scaledSize: new google.maps.Size(40, 40),
        anchor: new google.maps.Point(20, 38)
      },
      zIndex: 2
    });

    this.routeEndMarker = new google.maps.Marker({
      map: this.map,
      position: fin,
      title: 'Fin',
      icon: {
        url: this.svgPinUrl('#ef4444'),
        scaledSize: new google.maps.Size(40, 40),
        anchor: new google.maps.Point(20, 38)
      },
      zIndex: 2
    });

    // Ajustar vista para mostrar toda la ruta
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(inicio);
    bounds.extend(fin);
    if (path.length > 0) {
      path.forEach(p => bounds.extend(p));
    }
    this.map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
  }

  /**
   * Limpia los dibujos de ruta/variante del mapa
   */
  private limpiarRutaVariante(): void {
    if (this.routePolyline) {
      this.routePolyline.setMap(null);
      this.routePolyline = null;
    }
    if (this.routeStartMarker) {
      this.routeStartMarker.setMap(null);
      this.routeStartMarker = null;
    }
    if (this.routeEndMarker) {
      this.routeEndMarker.setMap(null);
      this.routeEndMarker = null;
    }
  }

  /**
   * Limpia el polígono de zona del mapa
   */
  private limpiarZona(): void {
    if (this.zonaPolygon) {
      this.zonaPolygon.setMap(null);
      this.zonaPolygon = null;
    }
  }

  /**
   * Limpia el marcador de taller del mapa
   */
  private limpiarTallerMarker(): void {
    if (this.tallerMarker) {
      this.tallerMarker.setMap(null);
      this.tallerMarker = null;
    }
  }

  /**
   * Dibuja el punto del taller seleccionado en el mapa usando lat/lng
   */
  private dibujarTaller(idTaller: number): void {
    if (!this.mapaInicializado || !this.map) {
      setTimeout(() => this.dibujarTaller(idTaller), 500);
      return;
    }

    const taller = this.listaTalleres.find((t: any) => Number(t?.id ?? t?.Id) === idTaller);
    if (!taller) {
      console.warn('[MapaComponent] Taller no encontrado:', idTaller);
      return;
    }

    const latVal = taller.lat ?? taller.Lat ?? taller.latitud ?? taller.Latitud;
    const lngVal = taller.lng ?? taller.Lng ?? taller.longitud ?? taller.Longitud;

    if (latVal == null || lngVal == null || !Number.isFinite(Number(latVal)) || !Number.isFinite(Number(lngVal))) {
      console.warn('[MapaComponent] Taller sin coordenadas válidas:', taller);
      return;
    }

    const position = { lat: Number(latVal), lng: Number(lngVal) };

    this.limpiarTallerMarker();

    this.tallerMarker = new google.maps.Marker({
      position,
      map: this.map,
      title: taller.nombre ?? taller.Nombre ?? 'Taller',
      icon: {
        url: this.svgPinUrl('#1F5AA8'),
        scaledSize: new google.maps.Size(40, 40),
        anchor: new google.maps.Point(20, 38)
      },
      zIndex: 2
    });

    this.map.panTo(position);
    this.map.setZoom(Math.max(this.map.getZoom() ?? 10, 14));
  }

  /**
   * Extrae el path de coordenadas desde diferentes formatos GeoJSON
   */
  private extractPathFromGeo(gx: any): Array<{ lat: number; lng: number }> {
    if (!gx) return [];

    // FeatureCollection
    if (
      gx.type === 'FeatureCollection' &&
      Array.isArray(gx.features) &&
      gx.features.length
    ) {
      const geom = gx.features[0]?.geometry;
      return this.extractPathFromGeo(geom);
    }

    // Feature
    if (gx.type === 'Feature' && gx.geometry) {
      return this.extractPathFromGeo(gx.geometry);
    }

    // Polygon con coordenadas GeoJSON [lng, lat]
    if (gx.type === 'Polygon' && Array.isArray(gx.coordinates)) {
      const ring = gx.coordinates[0] || [];
      return ring
        .map((p: any) =>
          Array.isArray(p) && p.length >= 2
            ? { lat: Number(p[1]), lng: Number(p[0]) }
            : null
        )
        .filter(Boolean) as Array<{ lat: number; lng: number }>;
    }

    // Array directo de coordenadas {lat, lng}
    if (Array.isArray(gx)) {
      return gx
        .map((p: any) => {
          if (p?.lat !== undefined && p?.lng !== undefined) {
            return { lat: Number(p.lat), lng: Number(p.lng) };
          }
          if (Array.isArray(p) && p.length >= 2) {
            // Puede venir como [lng, lat] o [lat, lng]
            return { lat: Number(p[1] || p[0]), lng: Number(p[0] || p[1]) };
          }
          return null;
        })
        .filter((p): p is { lat: number; lng: number } => 
          p !== null && Number.isFinite(p.lat) && Number.isFinite(p.lng)
        );
    }

    return [];
  }

  /**
   * Dibuja una zona en el mapa
   */
  dibujarZona(idZona: number): void {
    if (!this.mapaInicializado || !this.map) {
      console.warn('[MapaComponent] Mapa no inicializado, esperando...');
      setTimeout(() => this.dibujarZona(idZona), 500);
      return;
    }

    this.zonasService.obtenerZona(idZona).subscribe({
      next: (response: any) => {
        // La respuesta puede venir como objeto directo o como array en data
        let zona: any;
        if (Array.isArray(response?.data)) {
          zona = response.data.find((z: any) => z.id === idZona) || response.data[0];
        } else {
          zona = response?.data || response;
        }

        if (!zona) {
          console.error('[MapaComponent] Zona no encontrada');
          return;
        }

        // Extraer geocerca/polígono de diferentes campos posibles
        const geocerca: any =
          zona?.geocerca ??
          zona?.poligono ??
          zona?.polygon ??
          zona?.coordenadas ??
          zona?.geometria ??
          null;

        const path = this.extractPathFromGeo(geocerca);

        if (!Array.isArray(path) || path.length < 3) {
          console.error('[MapaComponent] Zona sin geocerca válida', {
            geocerca,
            path,
            pathLength: path?.length
          });
          return;
        }

        this.dibujarZonaEnMapa(path);
      },
      error: (error) => {
        console.error('[MapaComponent] Error al obtener zona:');
      }
    });
  }

  /**
   * Dibuja el polígono de la zona en el mapa
   */
  private dibujarZonaEnMapa(path: Array<{ lat: number; lng: number }>): void {
    if (!this.map || !Array.isArray(path) || path.length < 3) return;

    // Limpiar polígono anterior
    this.limpiarZona();

    // Crear polígono
    this.zonaPolygon = new google.maps.Polygon({
      paths: path,
      fillColor: '#1E88E5',
      fillOpacity: 0.15,
      strokeColor: '#1E88E5',
      strokeOpacity: 0.9,
      strokeWeight: 2,
      editable: false,
      draggable: false,
      map: this.map,
      zIndex: 10,
    });

    // Ajustar vista para mostrar toda la zona
    const bounds = new google.maps.LatLngBounds();
    path.forEach(p => bounds.extend(p));
    this.map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
  }

}
