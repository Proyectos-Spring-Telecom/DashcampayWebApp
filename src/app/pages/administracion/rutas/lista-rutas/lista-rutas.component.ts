import { Component, DestroyRef, inject, NgZone, OnInit, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { RutasService } from 'src/app/pages/services/ruta.service';
import { UsuariosService } from 'src/app/pages/services/usuarios.service';

@Component({
  selector: 'vex-lista-rutas',
  templateUrl: './lista-rutas.component.html',
  styleUrl: './lista-rutas.component.scss',
  animations: [fadeInRight400ms],
})
export class ListaRutasComponent implements OnInit {

  layoutCtrl = new UntypedFormControl('fullwidth');
  isLoading: boolean = false;
  listaRutas: any;
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
  public listaDipositivos: any;
  public listaBlueVox: any;
  public listaVehiculos: any;
  public listaClientes: any;
  isGrouped: boolean = false;
  @ViewChild(DxDataGridComponent, { static: false }) dataGrid!: DxDataGridComponent;


  modalAnim: 'in' | 'out' = 'in';
  modalOpen = false;
  modalClosing = false;
  modalErrorOpen = false;
  modalErrorClosing = false;
  selectedTransaccion: any = null;
  private readonly MAP_ID = 'DEMO_MAP_ID';
  hasCoords = false;

  constructor(
    private rutaSe: RutasService,
    private zone: NgZone,
    private route: Router,
    private alerts: AlertsService
  ) {
    this.showFilterRow = true;
    this.showHeaderFilter = true;
  }

  ngOnInit(): void {
    this.setupDataSource();
  }

  // hasPermission(permission: string): boolean {
  //   return this.permissionsService.getPermission(permission) !== undefined;
  // }

  agregarRuta() {
    this.route.navigateByUrl('/administracion/rutas/agregar-ruta');
  }

  onPageIndexChanged(e: any) {
    const pageIndex = e.component.pageIndex();
    this.paginaActual = pageIndex + 1;
    e.component.refresh();
  }

  setupDataSource() {
    this.loading = true;
    this.listaRutas = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const take = Number(loadOptions?.take) || this.pageSize || 10;
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;

        try {
          const resp: any = await lastValueFrom(
            this.rutaSe.obtenerRutasData(page, take)
          );
          this.loading = false;
          const rows: any[] = Array.isArray(resp?.data) ? resp.data : [];
          const meta = resp?.paginated || {};
          const totalRegistros =
            toNum(meta.total) ??
            toNum(resp?.total) ??
            rows.length;

          const paginaActual =
            toNum(meta.page) ??
            toNum(resp?.page) ??
            page;

          const totalPaginas =
            toNum(meta.lastPage) ??
            toNum(resp?.pages) ??
            Math.max(1, Math.ceil(totalRegistros / take));
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
    if (e.fullName === "searchPanel.text") {
      this.filtroActivo = e.value || '';
      if (!this.filtroActivo) {
        this.dataGrid.instance.option('dataSource', this.listaRutas);
        return;
      }
      const search = this.filtroActivo.toString().toLowerCase();
      const dataFiltrada = this.paginaActualData.filter((item: any) => {
        const idStr = item.id ? item.id.toString().toLowerCase() : '';
        const nombreStr = item.nombre ? item.nombre.toString().toLowerCase() : '';
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

  isNumber(value: any): boolean {
    return typeof value === 'number' && !isNaN(value);
  }

  verRuta(idRutaEspecifica: number) {
    this.route.navigateByUrl('/rutas/ver-ruta/' + idRutaEspecifica
    );
  };

  alCambiarOpcion(e: any): void {
    if (e.name === 'paging' && e.fullName === 'paging.pageIndex') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
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

  private getCoords(geojson: any): { lat: number | null; lng: number | null } {
    const c = geojson?.features?.[0]?.geometry?.coordinates;
    if (Array.isArray(c) && c.length >= 2) {
      const lng = Number(c[0]); const lat = Number(c[1]);
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
    return { lat: null, lng: null };
  }

  async activar(rowData: any) {
    const res = await this.alerts.open({
      type: 'warning',
      title: '¡Activar!',
      message: `¿Está seguro que requiere activar la ruta: <br> <strong>${rowData.nombre}</strong>?`,
      showCancel: true,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      backdropClose: false,
    });

    if (res !== 'confirm') return;

    this.rutaSe.updateEstatus(rowData.id, 1).subscribe(
      () => {
        this.alerts.open({
          type: 'success',
          title: '¡Confirmación Realizada!',
          message: 'La ruta ha sido activada.',
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

  async desactivar(rowData: any) {
    const res = await this.alerts.open({
      type: 'warning',
      title: '¡Desactivar!',
      message: `¿Está seguro que requiere desactivar la ruta: <br> <strong>${rowData.nombre}</strong>?`,
      showCancel: true,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      backdropClose: false,
    });

    if (res !== 'confirm') return;

    this.rutaSe.updateEstatus(rowData.id, 0).subscribe(
      () => {
        this.alerts.open({
          type: 'success',
          title: '¡Confirmación Realizada!',
          message: 'La ruta ha sido desactivada.',
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

  async eliminarRuta(ruta: any) {
    const res = await this.alerts.open({
      type: 'warning',
      title: '¡Eliminar Ruta!',
      message: `¿Está seguro que requiere eliminar la ruta: <br> <strong>${ruta.nombre}</strong>?`,
      showCancel: true,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      backdropClose: false,
    });

    if (res !== 'confirm') return;

    this.rutaSe.eliminarRuta(ruta.id).subscribe(
      () => {
        this.alerts.open({
          type: 'success',
          title: '¡Eliminado!',
          message: 'La ruta ha sido eliminada de forma exitosa.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });
        this.setupDataSource();
      },
      () => {
        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: 'Error al intentar eliminar la ruta.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });
      }
    );
  }


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

  onBackdropError() { this.closeErrorModal(); }
  closeErrorModal() {
    this.modalErrorClosing = true;
    setTimeout(() => {
      this.modalErrorOpen = false;
      this.modalErrorClosing = false;
    }, 200);
  }

  onBackdrop() { this.closeModal(); }
  closeModal() {
    this.modalClosing = true;
    setTimeout(() => {
      this.modalOpen = false;
      this.modalClosing = false;
    }, 600);
  }

  cerrarModal() {
    this.modalAnim = 'out';
    setTimeout(() => {
      this.modalOpen = false;
      this.selectedTransaccion = null;
    }, 220);
  }

  cerrarModalPorBackdrop(_event: MouseEvent) { this.cerrarModal(); }
  accionPrincipal() { this.cerrarModal(); }

  async abrirModal(raw: any) {
    const nombre = (raw?.nombre ?? raw?.Nombre ?? '').toString();
    const inicio = this.readLatLng(raw?.puntoInicio);
    const fin = this.readLatLng(raw?.puntoFin);

    this.selectedRuta = { nombre, inicio: inicio ?? undefined, fin: fin ?? undefined };
    this.hasCoords = Boolean(inicio && fin);

    this.inicioDireccion = this.hasCoords ? 'Obteniendo dirección…' : null;
    this.finDireccion = this.hasCoords ? 'Obteniendo dirección…' : null;

    this.modalOpen = true;
    this.modalAnim = 'in';
    this.modalClosing = false;

    if (this.hasCoords) {
      try {
        await this.waitForGoogleMaps();
        setTimeout(() => this.initializeMapRuta(inicio!, fin!), 120);
        const [dirIni, dirFin] = await Promise.all([
          this.reverseGeocode(inicio!.lat, inicio!.lng).catch(() => 'Dirección no disponible'),
          this.reverseGeocode(fin!.lat, fin!.lng).catch(() => 'Dirección no disponible')
        ]);
        this.inicioDireccion = dirIni;
        this.finDireccion = dirFin;
      } catch {
        this.hasCoords = false;
        this.inicioDireccion = null;
        this.finDireccion = null;
      }
    }
  }

  private readLatLng(obj: any): { lat: number; lng: number } | null {
    if (!obj || typeof obj !== 'object') return null;
    const lat = Number(obj.lat);
    const lng = Number(obj.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return null;
  }

  private waitForGoogleMaps(): Promise<void> {
    if ((window as any).google?.maps) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        if ((window as any).google?.maps) return resolve();
        if (Date.now() - start > 8000) return reject('Google Maps no cargó');
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  public inicioDireccion: string | null = null;
  public finDireccion: string | null = null;
  private geocoder!: google.maps.Geocoder;
  private initializeMapRuta(inicio: { lat: number; lng: number }, fin: { lat: number; lng: number }) {
    const el = document.getElementById('map');
    if (!el) return;
    el.innerHTML = '';

    const defaultCenter = { lat: 21.110778, lng: -86.762590 };
    const options: any = { center: defaultCenter, zoom: 14, clickableIcons: false };
    if (this.MAP_ID) options.mapId = this.MAP_ID;

    const map = new google.maps.Map(el, options);

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(inicio);
    bounds.extend(fin);
    map.fitBounds(bounds);

    const Advanced = (google.maps as any)?.marker?.AdvancedMarkerElement;
    const Pin = (google.maps as any)?.marker?.PinElement;
    const canAdvanced = Boolean(this.MAP_ID) && Advanced && Pin;

    // ======= NUEVO: preferir AdvancedMarker con Font Awesome =======
    const canAdvancedFa = Boolean(this.MAP_ID) && Advanced; // no requiere PinElement
    if (canAdvancedFa) {
      // helper local para crear el icono FA
      const createFaMarker = (iconClass: string, color: string, sizePx = 38): HTMLElement => {
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
      };

      const inicioEl = createFaMarker('fa-solid fa-location-dot', '#16a34a', 38);
      const finEl = createFaMarker('fa-solid fa-location-dot', '#ef4444', 38);

      new Advanced({ map, position: inicio, title: 'Inicio', content: inicioEl });
      new Advanced({ map, position: fin, title: 'Fin', content: finEl });
      return; // usamos FA; no seguimos a los otros caminos
    }
    // ======= FIN NUEVO =======

    if (canAdvanced) {
      // SIN línea: borderColor = background
      const pinInicio = new Pin({
        background: '#16a34a',
        borderColor: '#16a34a',
        glyph: this.makeWhiteDot()
      });
      const pinFin = new Pin({
        background: '#ef4444',
        borderColor: '#ef4444',
        glyph: this.makeWhiteDot()
      });

      new Advanced({ map, position: inicio, title: 'Inicio', content: pinInicio.element });
      new Advanced({ map, position: fin, title: 'Fin', content: pinFin.element });
    } else {
      const svgPinUrl = (color: string) => {
        const svg =
          `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">
           <path d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z" fill="${color}"/>
           <circle cx="12" cy="9" r="3" fill="#ffffff"/>
         </svg>`;
        return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
      };

      new google.maps.Marker({
        map,
        position: inicio,
        title: 'Inicio',
        icon: {
          url: svgPinUrl('#16a34a'),
          scaledSize: new google.maps.Size(40, 40),
          anchor: new google.maps.Point(20, 38)
        }
      });

      new google.maps.Marker({
        map,
        position: fin,
        title: 'Fin',
        icon: {
          url: svgPinUrl('#ef4444'),
          scaledSize: new google.maps.Size(40, 40),
          anchor: new google.maps.Point(20, 38)
        }
      });
    }
  }

  private makeWhiteDot(): HTMLElement {
    const el = document.createElement('div');
    el.style.width = '10px';
    el.style.height = '10px';
    el.style.borderRadius = '9999px';
    el.style.background = '#fff';
    el.style.boxShadow = 'none';
    return el;
  }

  private initializeMapTransaccion(lat: number, lng: number) {
    const el = document.getElementById('map');
    if (!el) return;
    el.innerHTML = '';

    const position = { lat, lng };
    const options: any = { center: position, zoom: 15, clickableIcons: false };
    if (this.MAP_ID) options.mapId = this.MAP_ID;

    const map = new google.maps.Map(el, options);
    this.putDotMarker(map, position, { title: `Transacción ${this.selectedTransaccion?.id ?? ''}`, color: '#3b82f6' });
  }

  private putDotMarker(
    map: any,
    position: any,
    opts: { title?: string; color: string }
  ) {
    const Advanced = google.maps?.marker?.AdvancedMarkerElement;
    const Pin = google.maps?.marker?.PinElement;
    const canAdvanced = Boolean(this.MAP_ID) && Advanced && Pin;

    if (canAdvanced) {
      const dot = document.createElement('div');
      dot.style.width = '10px';
      dot.style.height = '10px';
      dot.style.borderRadius = '9999px';
      dot.style.background = '#fff';
      dot.style.boxShadow = '0 0 0 2px rgba(255,255,255,.5)';

      const pin = new Pin({
        background: opts.color,
        borderColor: this.darken(opts.color, 0.3),
        glyph: dot
      });

      new Advanced({
        map,
        position,
        title: opts.title ?? '',
        content: pin.element
      });
      return;
    }

    const icon = {
      url: this.svgPinUrl(opts.color),
      scaledSize: new google.maps.Size(40, 40),
      anchor: new google.maps.Point(20, 38)
    };

    new google.maps.Marker({
      map,
      position,
      title: opts.title ?? '',
      icon
    });
  }

  private svgPinUrl(color: string) {
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">
      <path d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z" fill="${color}"/>
      <circle cx="12" cy="9" r="3" fill="#ffffff"/>
    </svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  private darken(hex: string, amount: number) {
    const n = (x: string) => parseInt(x, 16);
    const r = Math.max(0, Math.min(255, Math.floor(n(hex.slice(1, 3)) * (1 - amount))));
    const g = Math.max(0, Math.min(255, Math.floor(n(hex.slice(3, 5)) * (1 - amount))));
    const b = Math.max(0, Math.min(255, Math.floor(n(hex.slice(5, 7)) * (1 - amount))));
    const toHex = (v: number) => v.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  selectedRuta?: { nombre: string; inicio?: { lat: any, lng: any }; fin?: { lat: any, lng: any } };
  private createFaMarker(iconClass: string, color: string, sizePx = 36): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    wrap.style.transform = 'translateY(-6px)';

    const i = document.createElement('i');
    i.className = iconClass;
    i.style.fontSize = `${sizePx}px`;
    i.style.color = color;
    i.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,.35))';
    wrap.appendChild(i);

    return wrap;
  }

  private async reverseGeocode(lat: number, lng: number): Promise<string> {
    if (!this.geocoder) this.geocoder = new google.maps.Geocoder();
    const { results } = await this.geocoder.geocode({ location: { lat, lng } });
    return this.pickReadableAddress(results || [], 'Dirección no disponible');
  }

  private pickReadableAddress(results: any[], fallback: string): string {
    const plusPrefix = /^[2-9C-HJ-NP-X]{4,8}\+[2-9C-HJ-NP-X]{2,3}\s*/i;
    const preferTypes = [
      'street_address', 'route', 'intersection', 'premise',
      'neighborhood', 'sublocality', 'sublocality_level_1',
      'locality', 'administrative_area_level_2', 'political'
    ];

    const withoutPlus = (results || []).filter(
      (r: any) => !(r?.types || []).includes('plus_code')
    );
    const preferred =
      withoutPlus.find((r: any) => (r?.types || []).some((t: string) => preferTypes.includes(t))) ||
      withoutPlus[0] ||
      results[0];

    const raw = String(preferred?.formatted_address || '').trim();
    const cleaned = raw.replace(plusPrefix, '').replace(/^,\s*/, '').trim();
    return cleaned || fallback;
  }
}
