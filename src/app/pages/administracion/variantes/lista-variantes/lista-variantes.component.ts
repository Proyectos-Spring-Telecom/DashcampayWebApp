import { Component, DestroyRef, inject, NgZone, OnInit, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { VariantesService } from 'src/app/pages/services/variantes.service';

@Component({
  selector: 'vex-lista-variantes',
  templateUrl: './lista-variantes.component.html',
  styleUrl: './lista-variantes.component.scss',
  animations: [fadeInRight400ms],
})
export class ListaVariantesComponent implements OnInit {

layoutCtrl = new UntypedFormControl('fullwidth');
  isLoading: boolean = false;
  listaDerroteros: any;
  public grid: boolean = false;
  public showFilterRow: boolean;
  public showHeaderFilter: boolean;
  public loadingVisible: boolean = false;
  public mensajeAgrupar: string = 'Arrastre un encabezado de columna aquí para agrupar por esa columna';
  public loading!: boolean;
  public loadingMessage: string = 'Cargando...';
  public paginaActual: number = 1;
  public totalRegistros: number = 0;
  public pageSize: number = 20;
  public totalPaginas: number = 0;
  public autoExpandAllGroups: boolean = true;
  public paginaActualData: any[] = [];
  public filtroActivo: string = '';
  isGrouped: boolean = false;
  @ViewChild(DxDataGridComponent, { static: false }) dataGrid!: DxDataGridComponent;

  public selectedTransactionId: number | null = null;
  public selectedRutaNombre: string | null = null;
  public selectedNombreInicio: string | null = null;
  public selectedNombreFinal: string | null = null;
  public showMap = false;

  private readonly markerIconInicio: google.maps.Icon = {
    url: new URL('assets/images/markerGreen.png', document.baseURI).toString(),
    scaledSize: new google.maps.Size(42, 42),
    origin: new google.maps.Point(0, 0),
    anchor: new google.maps.Point(21, 42),
  };

  private readonly markerIconFin: google.maps.Icon = {
    url: new URL('assets/images/markerRed.png', document.baseURI).toString(),
    scaledSize: new google.maps.Size(42, 42),
    origin: new google.maps.Point(0, 0),
    anchor: new google.maps.Point(21, 42),
  };

  constructor(
    private variService: VariantesService,
    private zone: NgZone,
    private route: Router,
    private alerts: AlertsService,
  ) {
    this.showFilterRow = true;
    this.showHeaderFilter = true;
  }

  // hasPermission(permission: string): boolean {
  //   return this.permissionsService.getPermission(permission) !== undefined;
  // }

  
  limpiarCampos() {
    const today = new Date();
    this.dataGrid.instance.clearGrouping();
    this.isGrouped = false;
    this.setupDataSource();
    this.dataGrid.instance.refresh();
  }

  toggleExpandGroups() {
    const groupedColumns = this.dataGrid.instance.getVisibleColumns()
      .filter(col => (col.groupIndex ?? -1) >= 0);
    if (groupedColumns.length === 0) {
      this.alerts.open({
        type: 'info',
        title: '¡Ops!',
        message: 'Debes arrastar un encabezado de una columna para expandir o contraer grupos.',
        backdropClose: false
      });
    } else {
      this.autoExpandAllGroups = !this.autoExpandAllGroups;
      this.dataGrid.instance.refresh();
    }
  }

  ngOnInit(): void {
    this.setupDataSource();
  }

  agregarDerrotero() {
    this.route.navigateByUrl('/derroteros/agregar-derrotero');
  }

  onPageIndexChanged(e: any) {
    const pageIndex = e.component.pageIndex();
    this.paginaActual = pageIndex + 1;
    e.component.refresh();
  }

  setupDataSource() {
    this.loading = true;
    this.listaDerroteros = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const take = Number(loadOptions?.take) || this.pageSize || 10;
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;

        try {
          const resp: any = await lastValueFrom(
            this.variService.obtenerVariantesData(page, take)
          );
          this.loading = false;
          const rows: any[] = Array.isArray(resp?.data) ? resp.data : [];
          const meta = resp?.paginated || {};
          const totalRegistros =
            toNum(meta.total) ?? toNum(resp?.total) ?? rows.length;

          const paginaActual =
            toNum(meta.page) ?? toNum(resp?.page) ?? page;

          const totalPaginas =
            toNum(meta.lastPage) ?? toNum(resp?.pages) ?? Math.max(1, Math.ceil(totalRegistros / take));

          const dataTransformada = rows.map((item: any) => ({
            ...item,
            estatusTexto:
              item?.estatus === 1 ? 'Activo' :
                item?.estatus === 0 ? 'Inactivo' : null
          }));

          this.totalRegistros = totalRegistros;
          this.paginaActual = paginaActual;
          this.totalPaginas = totalPaginas;
          this.paginaActualData = dataTransformada;

          return {
            data: dataTransformada,
            totalCount: totalRegistros
          };
        } catch (err) {
          this.loading = false;
          console.error('Error en la solicitud de datos:');
          return { data: [], totalCount: 0 };
        }
      }
    });

    function toNum(v: any): number | null {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
  }

  onGridOptionChanged(e: any) {
    if (e.fullName === 'searchPanel.text') {
      this.filtroActivo = e.value || '';
      if (!this.filtroActivo) {
        this.dataGrid.instance.option('dataSource', this.listaDerroteros);
        return;
      }
      const search = this.filtroActivo.toString().toLowerCase();
      const dataFiltrada = this.paginaActualData.filter((item: any) => {
        const idStr = item.id ? item.id.toString().toLowerCase() : '';
        const nombreStr = item.nombreRuta ? item.nombreRuta.toString().toLowerCase() : '';
        const descripcionStr = item.descripcion ? item.descripcion.toString().toLowerCase() : '';
        const moduloStr = item.estatusTexto ? item.estatusTexto.toString().toLowerCase() : '';
        return (
          nombreStr.includes(search) ||
          descripcionStr.includes(search) ||
          moduloStr.includes(search) ||
          idStr.includes(search)
        );
      });
      this.dataGrid.instance.option('dataSource', dataFiltrada);
    }
  }


  async eliminarDerrotero(rowData: any) {
    const res = await this.alerts.open({
      type: 'warning',
      title: '¡Eliminar!',
      message: `¿Está seguro que requiere eliminar la variante: <strong>${rowData.nombreRuta}</strong>?`,
      showCancel: true,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      backdropClose: false,
    });
    if (res !== 'confirm') return;

    this.variService.eliminarVariante(rowData.id).subscribe(
      () => {
        this.alerts.open({
          type: 'success',
          title: '¡Confirmación Realizada!',
          message: 'La variante ha sido eliminada.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });
        this.setupDataSource();
        this.dataGrid.instance.refresh();
      },
      (error) => {
        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: String(error),
          confirmText: 'Confirmar',
          backdropClose: false,
        });
      }
    );
  }
  agregarVariante(){
    this.route.navigateByUrl('/administracion/variantes/agregar-variante')
  }

  
  // =====================
// PROPIEDADES necesarias
// (si ya las tienes, omite duplicarlas)
// =====================
modalAnim: 'in' | 'out' = 'in';
modalOpen = false;
modalClosing = false;

public hasCoords = false;
public inicioDireccion: string | null = null;
public finDireccion: string | null = null;

private readonly MAP_ID = 'DEMO_MAP_ID'; // usa tu mapId si ya tienes uno
private geocoder!: google.maps.Geocoder;

selectedDerrotero: {
  nombre: string;
  inicio?: { lat: number; lng: number };
  fin?: { lat: number; lng: number };
  recorrido: Array<{ lat: number; lng: number; nombre?: string }>;
} | null = null;


// =====================
// MÉTODO PRINCIPAL: abrir modal desde el grid
// =====================
async abrirModalVariante(raw: any) {
  const nombre = (raw?.nombreRuta ?? raw?.nombre ?? raw?.Nombre ?? '').toString();

  // Tu payload: puntoInicio/puntoFin con { direccion?, coordenadas:{lat,lng} } o directamente {lat,lng}
  const inicio = this.readLatLng(raw?.puntoInicio?.coordenadas) ?? this.readLatLng(raw?.puntoInicio);
  const fin    = this.readLatLng(raw?.puntoFin?.coordenadas)    ?? this.readLatLng(raw?.puntoFin);

  // Recorrido detallado: array de puntos {lat,lng} con nombre opcional
  const recorrido: Array<{ lat: number; lng: number; nombre?: string }> = Array.isArray(raw?.recorridoDetallado)
    ? raw.recorridoDetallado
        .map((p: any) => {
          const punto = this.readLatLng(p);
          if (!punto) return null;
          // Preservar el nombre si existe
          const nombre = p?.nombre ? String(p.nombre).trim() : undefined;
          return nombre ? { ...punto, nombre } : punto;
        })
        .filter((p: any): p is { lat: number; lng: number; nombre?: string } => !!p)
    : [];

  // Estado seleccionado
  this.selectedDerrotero = { nombre, inicio: inicio ?? undefined, fin: fin ?? undefined, recorrido };
  this.hasCoords = Boolean(inicio && fin);

  // Direcciones: usa las que vienen; si no, placeholder para geocoder
  this.inicioDireccion = raw?.puntoInicio?.direccion ?? (this.hasCoords ? 'Obteniendo dirección…' : null);
  this.finDireccion    = raw?.puntoFin?.direccion    ?? (this.hasCoords ? 'Obteniendo dirección…' : null);

  // Abrir modal
  this.modalOpen = true;
  this.modalAnim = 'in';
  this.modalClosing = false;

  if (this.hasCoords) {
    try {
      await this.waitForGoogleMaps();

      // Pintar mapa
      setTimeout(() => this.initializeMapDerrotero(inicio!, fin!, recorrido), 120);

      // Si no llegaron direcciones, hacer reverse geocoding (fix Promise<void>[]):
      const needIni = !raw?.puntoInicio?.direccion;
      const needFin = !raw?.puntoFin?.direccion;

      const tasks: Promise<void>[] = [];
      if (needIni) {
        tasks.push(
          this.reverseGeocode(inicio!.lat, inicio!.lng)
            .then(addr => { this.inicioDireccion = addr; })
            .catch(() => { this.inicioDireccion = 'Dirección no disponible'; })
        );
      }
      if (needFin) {
        tasks.push(
          this.reverseGeocode(fin!.lat, fin!.lng)
            .then(addr => { this.finDireccion = addr; })
            .catch(() => { this.finDireccion = 'Dirección no disponible'; })
        );
      }
      if (tasks.length) await Promise.all(tasks);

    } catch {
      this.hasCoords = false;
      this.inicioDireccion = null;
      this.finDireccion = null;
    }
  }
}


// =====================
// CERRAR MODAL (unificado, sin duplicados)
// - si le pasas un modal de Ngb/Material con .close(), lo cierra
// - si no, cierra tu modal custom
// =====================
cerrarModal(modal?: any) {
  if (modal?.close) {
    modal.close('Modal cerrado');
    return;
  }
  this.modalAnim = 'out';
  setTimeout(() => {
    this.modalOpen = false;
    this.selectedDerrotero = null;
  }, 220);
}

// alias por si el template llama a closeModal()
closeModal() { this.cerrarModal(); }

// backdrop del modal custom
onBackdrop() { this.cerrarModal(); }

// botón Confirmar
accionPrincipal() { this.cerrarModal(); }


// =====================
// HELPERS
// =====================
private readLatLng(obj: any): { lat: number; lng: number } | null {
  if (!obj || typeof obj !== 'object') return null;
  const lat = Number(obj.lat); const lng = Number(obj.lng);
  return (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng } : null;
}

private async waitForGoogleMaps(): Promise<void> {
  if ((window as any).google?.maps) return;
  await new Promise<void>((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if ((window as any).google?.maps) return resolve();
      if (Date.now() - start > 8000) return reject(new Error('Google Maps no cargó'));
      requestAnimationFrame(tick);
    };
    tick();
  });
}

private async reverseGeocode(lat: number, lng: number): Promise<string> {
  if (!this.geocoder) this.geocoder = new google.maps.Geocoder();
  const { results } = await this.geocoder.geocode({ location: { lat, lng } });
  return results?.[0]?.formatted_address ?? 'Dirección no disponible';
}

private createFaMarker(iconClass: string, color: string, sizePx = 38): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.alignItems = 'center';
  wrap.style.justifyContent = 'center';
  wrap.style.transform = 'translateY(-6px)';
  const i = document.createElement('i');
  i.className = iconClass; // 'fa-solid fa-location-dot'
  i.style.fontSize = `${sizePx}px`;
  i.style.color = color;
  i.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,.35))';
  wrap.appendChild(i);
  return wrap;
}


// =====================
// MAPA: marcadores + polilínea del recorrido
// =====================
private initializeMapDerrotero(
  inicio: { lat: number; lng: number },
  fin: { lat: number; lng: number },
  recorrido: Array<{ lat: number; lng: number; nombre?: string }>
) {
  const el = document.getElementById('map');
  if (!el) return;
  el.innerHTML = '';

  const defaultCenter = { lat: 21.110778, lng: -86.762590 };
  const options: any = { center: defaultCenter, zoom: 14, clickableIcons: false };
  if (this.MAP_ID) options.mapId = this.MAP_ID;

  const map = new google.maps.Map(el, options);

  // Ajuste de bounds con inicio, fin y recorrido
  const bounds = new google.maps.LatLngBounds();
  bounds.extend(inicio);
  bounds.extend(fin);
  if (Array.isArray(recorrido)) {
    for (const p of recorrido) bounds.extend(p);
  }
  map.fitBounds(bounds);

  const Advanced = (google.maps as any)?.marker?.AdvancedMarkerElement;
  const canAdvanced = Boolean(this.MAP_ID) && Advanced;
  const infoWindow = new google.maps.InfoWindow();

  // Marcadores (Font Awesome si Advanced; si no, Marker normal)
  if (canAdvanced) {
    new Advanced({ map, position: inicio, title: 'Inicio', content: this.createFaMarker('fa-solid fa-location-dot', '#16a34a', 38) });
    new Advanced({ map, position: fin,    title: 'Fin',    content: this.createFaMarker('fa-solid fa-location-dot', '#ef4444', 38) });
  } else {
    new google.maps.Marker({ map, position: inicio, title: 'Inicio' });
    new google.maps.Marker({ map, position: fin,    title: 'Fin' });
  }

  // Path: usa recorridoDetallado si existe; si no, una línea simple inicio->fin
  const path: Array<{ lat: number; lng: number }> =
    (Array.isArray(recorrido) && recorrido.length > 0) ? recorrido : [inicio, fin];

  new google.maps.Polyline({
    map,
    path,
    strokeColor: '#1F5AA8',
    strokeOpacity: 0.95,
    strokeWeight: 4
  });

  // Agregar marcadores discretos para puntos con nombre (estaciones)
  if (Array.isArray(recorrido) && recorrido.length > 0) {
    recorrido.forEach((punto) => {
      if (punto.nombre) {
        // Crear marcador discreto para estaciones
        const markerOptions: any = {
          map,
          position: { lat: punto.lat, lng: punto.lng },
          title: punto.nombre,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#1F5AA8',
            fillOpacity: 0.8,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 8
          },
          zIndex: google.maps.Marker.MAX_ZINDEX + 1
        };

        const marker = new google.maps.Marker(markerOptions);

        // Agregar InfoWindow con el nombre de la estación
        marker.addListener('click', () => {
          infoWindow.setContent(`
            <div style="padding: 8px; font-weight: 500; color: #1F5AA8;">
              <i class="fa fa-map-marker-alt" style="margin-right: 6px;"></i>
              ${punto.nombre}
            </div>
          `);
          infoWindow.open(map, marker);
        });
      }
    });
  }
}


}