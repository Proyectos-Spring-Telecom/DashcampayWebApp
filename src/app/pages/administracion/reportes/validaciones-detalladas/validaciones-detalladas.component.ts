import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, UntypedFormControl } from '@angular/forms';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { DxDataGridComponent } from 'devextreme-angular';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { ClientesService } from 'src/app/pages/services/clientes.service';
import { ZonasService } from 'src/app/pages/services/zonas.service';
import { RutasService } from 'src/app/pages/services/ruta.service';
import { VariantesService } from 'src/app/pages/services/variantes.service';
import { ReportesService } from 'src/app/pages/services/reportes.service';

@Component({
  selector: 'vex-validaciones-detalladas',
  templateUrl: './validaciones-detalladas.component.html',
  styleUrl: './validaciones-detalladas.component.scss',
  animations: [fadeInRight400ms],
})
export class ValidacionesDetalladasComponent implements OnInit {
  layoutCtrl = new UntypedFormControl('fullwidth');
  public showFilterRow: boolean;
  public showHeaderFilter: boolean;
  public loadingVisible: boolean = false;
  public mensajeAgrupar: string = 'Arrastre un encabezado de columna aquí para agrupar por esa columna';
  informacion: any[] = [];

  public paginaActual: number = 1;
  public totalRegistros: number = 0;
  public pageSize: number = 20;
  public totalPaginas: number = 0;
  pagerConfig = {
    showPageSizeSelector: true,
    allowedPageSizes: [50],
    showInfo: true,
    infoText: 'Página {0} de {1}',
    visible: true
  };
  public data!: string;
  public paginaActualData: any[] = [];
  public filtroActivo: string = '';
  @ViewChild(DxDataGridComponent, { static: false }) dataGrid!: DxDataGridComponent;
  public autoExpandAllGroups: boolean = true;
  isGrouped: boolean = false;

  filtrosForm!: FormGroup;
  listaClientes: any[] = [];
  listaZonas: any[] = [];
  listaRutas: any[] = [];
  listaVariantes: any[] = [];

  constructor(
    private alerts: AlertsService,
    private fb: FormBuilder,
    private clientesService: ClientesService,
    private zonasService: ZonasService,
    private rutasService: RutasService,
    private variantesService: VariantesService,
    private reportesService: ReportesService
  ) {
    this.showFilterRow = true;
    this.showHeaderFilter = true;
    this.initForm();
  }

  initForm(): void {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    this.filtrosForm = this.fb.group({
      fechaInicio: [firstDay],
      fechaFin: [lastDay],
      idCliente: [null],
      idRegion: [{value: null, disabled: true}],
      idRuta: [{value: null, disabled: true}],
      idVariante: [{value: null, disabled: true}]
    });
  }

  ngOnInit(): void {
    this.cargarListas();
    
    // Suscribirse a cambios en el cliente para habilitar/deshabilitar zonas
    this.filtrosForm.get('idCliente')?.valueChanges.subscribe((idCliente) => {
      // Limpiar siempre los filtros dependientes cuando cambia el cliente
      this.filtrosForm.get('idRegion')?.setValue(null, { emitEvent: false });
      this.filtrosForm.get('idRuta')?.setValue(null, { emitEvent: false });
      this.filtrosForm.get('idVariante')?.setValue(null, { emitEvent: false });
      this.listaZonas = [];
      this.listaRutas = [];
      this.listaVariantes = [];

      if (idCliente) {
        // Habilitar campo de zonas y cargar zonas del cliente
        this.filtrosForm.get('idRegion')?.enable();
        this.cargarZonasByCliente(idCliente);
      } else {
        // Deshabilitar campos dependientes
        this.filtrosForm.get('idRegion')?.disable();
        this.filtrosForm.get('idRuta')?.disable();
        this.filtrosForm.get('idVariante')?.disable();
      }
    });

    // Suscribirse a cambios en la zona para habilitar/deshabilitar rutas
    this.filtrosForm.get('idRegion')?.valueChanges.subscribe((idRegion) => {
      // Limpiar siempre los filtros dependientes cuando cambia la zona
      this.filtrosForm.get('idRuta')?.setValue(null, { emitEvent: false });
      this.filtrosForm.get('idVariante')?.setValue(null, { emitEvent: false });
      this.listaRutas = [];
      this.listaVariantes = [];

      if (idRegion) {
        // Habilitar campo de rutas y cargar rutas del cliente
        const idCliente = this.filtrosForm.get('idCliente')?.value;
        if (idCliente) {
          this.filtrosForm.get('idRuta')?.enable();
          this.cargarRutasByCliente(idCliente);
        }
      } else {
        // Deshabilitar campos dependientes
        this.filtrosForm.get('idRuta')?.disable();
        this.filtrosForm.get('idVariante')?.disable();
      }
    });

    // Suscribirse a cambios en la ruta para habilitar/deshabilitar variantes
    this.filtrosForm.get('idRuta')?.valueChanges.subscribe((idRuta) => {
      // Limpiar siempre el filtro de variante cuando cambia la ruta
      this.filtrosForm.get('idVariante')?.setValue(null, { emitEvent: false });
      this.listaVariantes = [];

      if (idRuta) {
        // Habilitar campo de variantes y cargar variantes de la ruta
        this.filtrosForm.get('idVariante')?.enable();
        this.cargarVariantesByRuta(idRuta);
      } else {
        // Deshabilitar campo de variantes
        this.filtrosForm.get('idVariante')?.disable();
      }
    });
  }

  cargarListas(): void {
    // Cargar clientes usando clientes/list
    this.clientesService.obtenerClientesList().subscribe({
      next: (response: any) => {
        this.listaClientes = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
      },
      error: (error) => {
        console.error('Error al cargar clientes:');
      }
    });

    // No cargar zonas, rutas y variantes inicialmente, se cargarán cuando se seleccione cliente/zona/ruta
    this.listaZonas = [];
    this.listaRutas = [];
    this.listaVariantes = [];
  }

  /**
   * Carga las zonas filtradas por cliente
   */
  cargarZonasByCliente(idCliente: number): void {
    this.zonasService.obtenerZonasByCliente(idCliente).subscribe({
      next: (response: any) => {
        this.listaZonas = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
      },
      error: (error) => {
        console.error('Error al cargar zonas por cliente:');
        this.listaZonas = [];
      }
    });
  }

  /**
   * Carga las rutas filtradas por cliente
   */
  cargarRutasByCliente(idCliente: number): void {
    this.rutasService.obtenerRutasByIdCliente(idCliente).subscribe({
      next: (response: any) => {
        this.listaRutas = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
      },
      error: (error) => {
        console.error('Error al cargar rutas por cliente:');
        this.listaRutas = [];
      }
    });
  }

  /**
   * Carga las variantes filtradas por ruta
   */
  cargarVariantesByRuta(idRuta: number): void {
    this.variantesService.obtenerVariantesByRuta(idRuta).subscribe({
      next: (response: any) => {
        this.listaVariantes = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
      },
      error: (error) => {
        console.error('Error al cargar variantes por ruta:');
        this.listaVariantes = [];
      }
    });
  }

  formatearFecha(d: Date | string): string {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  aplicarFiltros(): void {
    this.loadingVisible = true;
    const formValue = this.filtrosForm.getRawValue();

    const fechaInicio = formValue.fechaInicio
      ? this.formatearFecha(formValue.fechaInicio)
      : this.formatearFecha(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const fechaFin = formValue.fechaFin
      ? this.formatearFecha(formValue.fechaFin)
      : this.formatearFecha(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));

    const payload = {
      fechaInicio,
      fechaFin,
      idCliente: formValue.idCliente || null,
      idZona: formValue.idRegion || null,
      idRuta: formValue.idRuta || null,
      idVariante: formValue.idVariante || null
    };

    this.reportesService.obtenerTransaccionesDebit(payload).subscribe({
      next: (response: any) => {
        this.loadingVisible = false;
        const raw = response?.data ?? response;
        const list = Array.isArray(raw) ? raw : [];
        this.informacion = list.map((item: any, index: number) => this.mapearItemTransaccion(item, index));
        if (this.dataGrid?.instance) {
          this.dataGrid.instance.clearGrouping();
          this.dataGrid.instance.refresh();
        }
      },
      error: (err) => {
        this.loadingVisible = false;
        console.error('Error al obtener transacciones débit:');
        this.alerts.open({
          type: 'error',
          title: 'Error',
          message: err?.error?.message || err?.message || 'No se pudieron cargar las transacciones.',
          backdropClose: false
        });
      }
    });
  }

  private mapearItemTransaccion(item: any, index: number): any {
    const get = (obj: any, ...keys: string[]) => {
      if (!obj) return null;
      for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
      return null;
    };
    const id = get(item, 'id') ?? index + 1;
    const fechaRaw = get(item, 'fechaHora', 'fecha', 'fechaTransaccion', 'fechaValidacion');
    const fechaHora = fechaRaw ? (fechaRaw instanceof Date ? fechaRaw : new Date(fechaRaw)) : null;
    return {
      id,
      idTx: get(item, 'idTx', 'idTransaccion', 'numeroTransaccion') ?? `TX-${id}`,
      fechaHora,
      monto: Number(get(item, 'monto', 'importe', 'cantidad') ?? 0),
      monederoSerie: get(item, 'numeroSerieMonedero', 'monederoSerie', 'serieMonedero', 'idMonedero', 'monedero') ?? '',
      dispositivoSerie: get(item, 'numeroSerieValidador', 'dispositivoSerie', 'serieValidador', 'idValidador', 'validador') ?? '',
      latitud: Number(get(item, 'latitud', 'lat') ?? 0),
      longitud: Number(get(item, 'longitud', 'lng', 'lon') ?? 0),
      rutaDerrotero: get(item, 'nombreRuta', 'rutaDerrotero', 'ruta', 'derrotero') ?? '',
      viaje: Number(get(item, 'numeroViaje', 'viaje', 'idViaje') ?? 0),
      turno: get(item, 'numeroTurno', 'turno', 'idTurno', 'nombreTurno') ?? ''
    };
  }

  limpiarCampos(): void {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    this.filtrosForm.patchValue({
      fechaInicio: firstDay,
      fechaFin: lastDay,
      idCliente: null,
      idRegion: null,
      idRuta: null,
      idVariante: null
    });
    this.filtrosForm.get('idRegion')?.setValue(null, { emitEvent: false });
    this.filtrosForm.get('idRuta')?.setValue(null, { emitEvent: false });
    this.filtrosForm.get('idVariante')?.setValue(null, { emitEvent: false });
    this.informacion = [];
    if (this.dataGrid?.instance) {
      this.dataGrid.instance.clearGrouping();
      this.dataGrid.instance.refresh();
    }
    this.isGrouped = false;
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

}