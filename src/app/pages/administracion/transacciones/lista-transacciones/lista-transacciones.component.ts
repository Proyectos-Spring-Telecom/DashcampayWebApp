import { Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, UntypedFormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { TransaccionesService } from 'src/app/pages/services/transacciones.service';
import { mensajeRangoFechas } from 'src/app/core/utils/rango-fechas';

@Component({
  selector: 'vex-lista-transacciones',
  templateUrl: './lista-transacciones.component.html',
  styleUrl: './lista-transacciones.component.scss',
  animations: [fadeInRight400ms],
})
export class ListaTransaccionesComponent implements OnInit {

  layoutCtrl = new UntypedFormControl('fullwidth');

  isLoading = false;
  loading = false;
  listaTransacciones: any;
  public grid = false;
  public showFilterRow: boolean;
  public showHeaderFilter: boolean;
  public loadingVisible = false;
  public mensajeAgrupar = 'Arrastre un encabezado de columna aquí para agrupar por esa columna';
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  public autoExpandAllGroups = true;
  @ViewChild(DxDataGridComponent, { static: false }) dataGrid!: DxDataGridComponent;
  isGrouped = false;

  modalAnim: 'in' | 'out' = 'in';
  modalOpen = false;
  modalClosing = false;
  modalErrorOpen = false;
  modalErrorClosing = false;
  selectedTransaccion: any = null;
  private readonly MAP_ID = 'DEMO_MAP_ID';
  hasCoords = false;
  public paginaActual: number = 1;
  public totalRegistros: number = 0;
  public pageSize: number = 20;
  public totalPaginas: number = 0;
  public paginaActualData: any[] = [];
  public filtroActivo: string = '';
  filtroForm!: FormGroup;
  fechaInicio: string | null = null;
  fechaFin: string | null = null;
  fechaInicioFiltro: string | null = null;
  fechaFinFiltro: string | null = null;

  constructor(
    private tranService: TransaccionesService,
    private alerts: AlertsService,
    private route: Router,
    private fb: FormBuilder
  ) {
    this.showFilterRow = true;
    this.showHeaderFilter = true;
    this.initFiltroForm();
  }

  initFiltroForm() {
    this.filtroForm = this.fb.group({
      fechaInicio: [null],
      fechaFin: [null]
    });
  }

  ngOnInit(): void {
    this.setupDataSource();
  }

  agregarTransaccion() {
    this.route.navigateByUrl('/administracion/transacciones/agregar-transaccion')
  }

  limpiarCampos() {
    this.dataGrid.instance.clearGrouping();
    this.isGrouped = false;
    this.filtroForm.reset();
    this.fechaInicio = null;
    this.fechaFin = null;
    this.fechaInicioFiltro = null;
    this.fechaFinFiltro = null;
    this.setupDataSource();
    this.dataGrid.instance.refresh();
  }

  buscar() {
    const formValue = this.filtroForm.getRawValue();
    this.fechaInicioFiltro = formValue.fechaInicio ? this.formatDate(formValue.fechaInicio) : null;
    this.fechaFinFiltro = formValue.fechaFin ? this.formatDate(formValue.fechaFin) : null;
    this.fechaInicio = this.fechaInicioFiltro;
    this.fechaFin = this.fechaFinFiltro;
    this.setupDataSource();
    if (this.dataGrid?.instance) {
      this.dataGrid.instance.refresh();
    }
  }

  formatDate(date: Date): string {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  toggleExpandGroups() {
    const groupedColumns = this.dataGrid.instance
      .getVisibleColumns()
      .filter((col) => (col.groupIndex ?? -1) >= 0);

    if (groupedColumns.length === 0) {
      this.alerts.open({
        type: 'info',
        title: '¡Ops!',
        message: 'Debes arrastrar un encabezado de una columna para expandir o contraer grupos.',
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

  onAnimationEnd() {
    if (this.modalAnim === 'out') {
      this.modalOpen = false;
    }
  }
  async abrirModal(raw: any) {
    const id = raw?.id ?? raw?.Id ?? null;

    // Intentar primero con latitudInicial/longitudInicial, si no existen usar latitudFinal/longitudFinal
    const latInicial = raw?.latitudInicial != null ? raw.latitudInicial : (raw?.LatitudInicial != null ? raw.LatitudInicial : null);
    const lngInicial = raw?.longitudInicial != null ? raw.longitudInicial : (raw?.LongitudInicial != null ? raw.LongitudInicial : null);
    
    const latFinal = raw?.latitudFinal != null ? raw.latitudFinal : (raw?.LatitudFinal != null ? raw.LatitudFinal : null);
    const lngFinal = raw?.longitudFinal != null ? raw.longitudFinal : (raw?.LongitudFinal != null ? raw.LongitudFinal : null);
    
    const latStr = (latInicial != null && latInicial !== '') ? String(latInicial) : ((latFinal != null && latFinal !== '') ? String(latFinal) : '');
    const lngStr = (lngInicial != null && lngInicial !== '') ? String(lngInicial) : ((lngFinal != null && lngFinal !== '') ? String(lngFinal) : '');

    const tipoRaw = (raw?.tipoTransaccion ?? raw?.tipo ?? '').toString();
    const tipoUI = tipoRaw === 'RECARGA' ? 'Recarga' : tipoRaw === 'DEBITO' ? 'Débito' : (tipoRaw || null);

    const fechaISO = raw?.fechaHora ?? raw?.FechaHora ?? null;
    const fecha = fechaISO ? new Date(fechaISO) : null;
    
    const fechaHoraInicioISO = raw?.fechaHoraInicio ?? null;
    const fechaHoraInicio = fechaHoraInicioISO ? new Date(fechaHoraInicioISO) : null;
    
    const fechaHoraFinalISO = raw?.fechaHoraFinal ?? null;
    const fechaHoraFinal = fechaHoraFinalISO ? new Date(fechaHoraFinalISO) : null;

    const montoNum =
      typeof raw?.monto === 'number' ? raw.monto
        : (raw?.monto != null ? Number(raw.monto)
          : (typeof raw?.Monto === 'number' ? raw.Monto
            : Number((raw?.Monto ?? '0').toString().replace(/[^0-9.-]/g, '')) || 0));

    this.selectedTransaccion = { id, fecha, fechaHoraInicio, fechaHoraFinal, tipo: tipoUI, monto: montoNum, lat: latStr, lng: lngStr };

    const latNum = parseFloat(latStr as string);
    const lngNum = parseFloat(lngStr as string);

    this.hasCoords =
      Number.isFinite(latNum) &&
      Number.isFinite(lngNum) &&
      !(latNum === 0 && lngNum === 0);

    this.modalOpen = true;
    this.modalAnim = 'in';
    this.modalClosing = false;

    // sólo intenta cargar mapa si hay coordenadas
    if (this.hasCoords) {
      await this.waitForGoogleMaps();
      setTimeout(() => this.initializeMap(latStr, lngStr), 120);
    }
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

  private initializeMap(lat: string, lng: string): void {
    if (!this.hasCoords) return;

    const el = document.getElementById('map');
    if (!el) return;

    el.innerHTML = '';

    const position = {
      lat: Number.parseFloat(lat || '0'),
      lng: Number.parseFloat(lng || '0')
    };
    if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return;

    const options: any = { center: position, zoom: 15 };
    if (this.MAP_ID) options.mapId = this.MAP_ID;

    const map = new google.maps.Map(el, options);
    const Advanced = google.maps?.marker?.AdvancedMarkerElement;
    const canUseAdvanced = Boolean(this.MAP_ID) && Boolean(Advanced);

    if (canUseAdvanced) {
      new Advanced({ map, position, title: `Transacción ${this.selectedTransaccion?.id ?? ''}` });
    } else {
      new google.maps.Marker({ map, position, title: `Transacción ${this.selectedTransaccion?.id ?? ''}` });
    }
  }

  onGridOptionChanged(e: any) {
    if (e.fullName === "searchPanel.text") {
      this.filtroActivo = e.value || '';
      if (!this.filtroActivo) {
        this.dataGrid.instance.option('dataSource', this.listaTransacciones);
        return;
      }
      const search = this.filtroActivo.toLowerCase();
      const dataFiltrada = this.paginaActualData.filter((item: any) =>
        (item.nombre && item.nombre.toLowerCase().includes(search)) ||
        (item.descripcion && item.descripcion.toLowerCase().includes(search)) ||
        (item.modulo?.nombre && item.modulo.nombre.toLowerCase().includes(search))
      );
      this.dataGrid.instance.option('dataSource', dataFiltrada);
    }
  }

  onPageIndexChanged(e: any) {
    const pageIndex = e.component.pageIndex();
    this.paginaActual = pageIndex + 1;
    e.component.refresh();
  }

  setupDataSource() {
    this.loading = true;

    this.listaTransacciones = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        this.loading = true;

        const take = Math.min(Number(loadOptions?.take) || this.pageSize || 10, 100);
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;

        const body = {
          page,
          limit: take,
          fechaInicio: this.fechaInicioFiltro,
          fechaFin: this.fechaFinFiltro
        };
        const rango = mensajeRangoFechas(this.fechaInicioFiltro, this.fechaFinFiltro);
        if (rango) {
          this.loading = false;
          this.alerts.open({
            type: 'warning',
            title: 'Rango de fechas',
            message: rango,
            confirmText: 'Aceptar',
            backdropClose: false,
          });
          return { data: [], totalCount: 0 };
        }

        try {
          const resp: any = await lastValueFrom(
            this.tranService.obtenerTransaccionesData(body)
          );
          this.loading = false;

          const rows: any[] = Array.isArray(resp?.data) ? resp.data : [];
          const meta = resp?.paginated ?? {};
          const totalRegistros = toNum(meta.total) ?? rows.length;
          const paginaActual = toNum(meta.page) ?? page;
          const totalPaginas =
            toNum(meta.lastPage) ?? Math.max(1, Math.ceil(totalRegistros / take));

          const dataTransformada = rows.map((x: any) => {
            const pasajero = [x?.nombrePasajero, x?.apellidoPaternoPasajero, x?.apellidoMaternoPasajero]
              .filter(v => !!(v && String(v).trim()))
              .join(' ')
              .trim();

            return {
              id: x?.id ?? null,
              Id: x?.id ?? null,
              tipoTransaccion: x?.tipoTransaccion ?? null,
              monto: toMoney(x?.monto),
              latitudFinal: x?.latitudFinal ?? null,
              longitudFinal: x?.longitudFinal ?? null,
              fechaHoraFinal: x?.fechaHoraFinal ?? null,
              fhRegistro: x?.fhRegistro ?? null,
              numeroSerieMonedero: x?.numeroSerieMonedero ?? null,
              numeroSerieValidador: x?.numeroSerieValidador ?? null,
              pasajero: pasajero || 'Sin registro',
              nombreCliente: x?.nombreCliente ?? null,
              apellidoPaternoCliente: x?.apellidoPaternoCliente ?? null,
              apellidoMaternoCliente: x?.apellidoMaternoCliente ?? null
            };
          });

          this.totalRegistros = totalRegistros;
          this.paginaActual = paginaActual;
          this.totalPaginas = totalPaginas;
          this.paginaActualData = dataTransformada;

          return {
            data: dataTransformada,
            totalCount: totalRegistros
          };
        } catch (error) {
          this.loading = false;
          console.error('[TRANSACCIONES] Error:');
          return { data: [], totalCount: 0 };
        }
      }
    });

    function toNum(v: any): number | null {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }

    function toMoney(v: any): number | null {
      if (v === null || v === undefined) return null;
      const s = String(v).replace(',', '.').replace(/[^0-9.-]/g, '');
      const n = Number(s);
      return Number.isFinite(n) ? Number(n.toFixed(2)) : null;
    }
  }

  customizePasajeroText = (cellInfo: any) => cellInfo?.value ? cellInfo.value : 'sin registro';

}
