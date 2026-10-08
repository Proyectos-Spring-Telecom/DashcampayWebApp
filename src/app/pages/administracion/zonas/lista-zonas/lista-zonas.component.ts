import { mensajeDeError } from 'src/app/core/utils/mensaje-error';
import { Component, OnInit, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { ZonasService } from 'src/app/pages/services/zonas.service';
import { loadGoogleMaps as cargarGoogleMaps } from 'src/app/core/security/load-google-maps';

declare const google: any;

@Component({
  selector: 'vex-lista-zonas',
  templateUrl: './lista-zonas.component.html',
  styleUrl: './lista-zonas.component.scss',
  animations: [fadeInRight400ms],
})
export class ListaZonasComponent implements OnInit, AfterViewInit, OnDestroy {

  layoutCtrl = new UntypedFormControl('fullwidth');
  @ViewChild(DxDataGridComponent, { static: false }) dataGrid!: DxDataGridComponent;
  public mensajeAgrupar: string = 'Arrastre un encabezado de columna aquí para agrupar por esa columna';
  public listaZonas: any;
  public showFilterRow: boolean;
  public showHeaderFilter: boolean;
  public loading!: boolean;
  public loadingMessage: string = 'Cargando...';
  public showExportGrid!: boolean;
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

  // Modal y mapa
  modalOpen = false;
  modalClosing = false;
  modalAnim: 'in' | 'out' = 'in';
  selectedZona: any = null;
  private map?: any;
  private polygon?: any;
  private readonly defaultCenter = { lat: 21.110778, lng: -86.762590 };
  private readonly defaultZoom = 13;

  constructor(
    private zonService: ZonasService,
    private alerts: AlertsService,
    private route: Router,
  ) {
    this.showFilterRow = true;
    this.showHeaderFilter = true;
  }

  ngOnInit() {
    this.setupDataSource();
    // this.obtenerListaModulos();
  }

  // hasPermission(permission: string): boolean {-
  //   return this.permissionsService.getPermission(permission) !== undefined;
  // }

  agregarZona() {
    this.route.navigateByUrl('/administracion/zonas/agregar-zona');
  }

  actualizarZona(idZona: number) {
    this.route.navigateByUrl('/administracion/zonas/editar-zona/' + idZona);
  }

  async activar(rowData: any) {
    const res = await this.alerts.open({
      type: 'warning',
      title: '¡Activar!',
      message: '¿Está seguro que requiere activar esta zona?',
      showCancel: true,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      backdropClose: false,
    });

    if (res !== 'confirm') return;

    this.zonService.updateEstatus(rowData.id, 1).subscribe(
      () => {
        this.alerts.open({
          type: 'success',
          title: '¡Confirmación Realizada!',
          message: 'La zona ha sido activada.',
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
          message: mensajeDeError(error),
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
      message: '¿Está seguro que requiere desactivar esta zona?',
      showCancel: true,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      backdropClose: false,
    });

    if (res !== 'confirm') return;

    this.zonService.updateEstatus(rowData.id, 0).subscribe(
      () => {
        this.alerts.open({
          type: 'success',
          title: '¡Confirmación Realizada!',
          message: 'La zona ha sido desactivada.',
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
          message: mensajeDeError(error),
          confirmText: 'Confirmar',
          backdropClose: false,
        });
      }
    );
  }


  onPageIndexChanged(e: any) {
    const pageIndex = e.component.pageIndex();
    this.paginaActual = pageIndex + 1;
    e.component.refresh();
  }

  setupDataSource() {
    this.loading = true;
    this.listaZonas = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const take = Number(loadOptions?.take) || this.pageSize || 10;
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;

        try {
          const resp: any = await lastValueFrom(
            this.zonService.obtenerZonasData(page, take)
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
        this.dataGrid.instance.option('dataSource', this.listaZonas);
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

  agregarVehiculo() {
    this.route.navigateByUrl('/administracion/vehiculos/agregar-vehiculo')
  }

  async visualizarZona(rowData: any) {
    this.selectedZona = rowData;
    this.modalOpen = true;
    this.modalAnim = 'in';
    this.modalClosing = false;

    // Obtener los datos completos de la zona
    this.zonService.obtenerZona(rowData.id).subscribe({
      next: (response: any) => {
        const data = Array.isArray(response?.data) ? response.data[0] : response?.data;
        if (data) {
          this.selectedZona = { ...rowData, ...data };
          setTimeout(() => this.initMapModal(), 100);
        }
      },
      error: (err) => {
        console.error('Error al obtener zona:');
        setTimeout(() => this.initMapModal(), 100);
      }
    });
  }

  ngAfterViewInit(): void {
    // No necesitamos cargar maps aquí, se carga cuando se abre el modal
  }

  ngOnDestroy(): void {
    if (this.polygon) {
      this.polygon.setMap(null);
    }
    if (this.map) {
      this.map = null;
    }
  }

  cerrarModal() {
    this.modalAnim = 'out';
    this.modalClosing = true;
    setTimeout(() => {
      this.modalOpen = false;
      this.selectedZona = null;
      if (this.polygon) {
        this.polygon.setMap(null);
        this.polygon = undefined;
      }
      if (this.map) {
        this.map = null;
      }
    }, 300);
  }

  onBackdrop() {
    this.cerrarModal();
  }

  private async initMapModal() {
    await this.loadGoogleMaps();
    await new Promise(requestAnimationFrame);
    
    const el = document.getElementById('map-modal');
    if (!el) return;

    if (!(window as any).google?.maps?.Map) {
      el.replaceChildren();
      const wrap = document.createElement('div');
      wrap.style.cssText =
        'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#e9ecef;';
      const inner = document.createElement('div');
      inner.style.textAlign = 'center';
      const icon = document.createElement('div');
      icon.style.fontSize = '42px';
      icon.textContent = '⚠️';
      const title = document.createElement('div');
      title.style.cssText = 'font-weight:600;margin-top:8px;color:#333;';
      title.textContent = 'Google Maps no ha cargado';
      inner.append(icon, title);
      wrap.appendChild(inner);
      el.appendChild(wrap);
      return;
    }

    this.map = new google.maps.Map(el, {
      center: this.defaultCenter,
      zoom: this.defaultZoom,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      clickableIcons: false,styles: [
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
    });

    // Dibujar polígono si existe geocerca
    const gxAny: any =
      this.selectedZona?.geocerca ??
      this.selectedZona?.poligono ??
      this.selectedZona?.polygon ??
      this.selectedZona?.coordenadas ??
      null;

    const path = this.extractPathFromGeo(gxAny);
    if (Array.isArray(path) && path.length >= 3) {
      this.drawPolygonFromPath(path);
      this.fitToPolygon();
    } else {
      // Si no hay geocerca, centrar en la ubicación por defecto
      this.map.setCenter(this.defaultCenter);
      this.map.setZoom(this.defaultZoom);
    }
  }

  private extractPathFromGeo(gx: any): Array<{ lat: number; lng: number }> {
    if (!gx) return [];

    if (
      gx.type === 'FeatureCollection' &&
      Array.isArray(gx.features) &&
      gx.features.length
    ) {
      const geom = gx.features[0]?.geometry;
      return this.extractPathFromGeo(geom);
    }

    if (gx.type === 'Feature' && gx.geometry) {
      return this.extractPathFromGeo(gx.geometry);
    }

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

    if (Array.isArray(gx)) {
      return gx
        .map((p: any) => ({ lat: Number(p?.lat), lng: Number(p?.lng) }))
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    }

    return [];
  }

  private drawPolygonFromPath(path: Array<{ lat: number; lng: number }>): void {
    if (!this.map || !Array.isArray(path) || path.length < 3) return;

    if (this.polygon) {
      this.polygon.setMap(null);
      this.polygon = undefined;
    }

    this.polygon = new google.maps.Polygon({
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
  }

  private fitToPolygon(): void {
    if (!this.map || !this.polygon) return;
    const bounds = new google.maps.LatLngBounds();
    this.polygon.getPath().forEach((ll: any) => bounds.extend(ll));
    this.map.fitBounds(bounds);
  }

  private loadGoogleMaps(): Promise<void> {

    return cargarGoogleMaps();

  }

}
