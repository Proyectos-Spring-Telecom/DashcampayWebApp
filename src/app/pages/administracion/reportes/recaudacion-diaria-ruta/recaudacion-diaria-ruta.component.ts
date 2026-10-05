import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, UntypedFormControl } from '@angular/forms';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { DxDataGridComponent } from 'devextreme-angular';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { ReportesService } from 'src/app/pages/services/reportes.service';
import { ClientesService } from 'src/app/pages/services/clientes.service';
import { ZonasService } from 'src/app/pages/services/zonas.service';
import { RutasService } from 'src/app/pages/services/ruta.service';
import { VariantesService } from 'src/app/pages/services/variantes.service';

@Component({
  selector: 'vex-recaudacion-diaria-ruta',
  templateUrl: './recaudacion-diaria-ruta.component.html',
  styleUrl: './recaudacion-diaria-ruta.component.scss',
  animations: [fadeInRight400ms],
})
export class RecaudacionDiariaRutaComponent implements OnInit {
  layoutCtrl = new UntypedFormControl('fullwidth');
  public showFilterRow: boolean;
  public showHeaderFilter: boolean;
  public loadingVisible: boolean = false;
  public mensajeAgrupar: string = 'Arrastre un encabezado de columna aquí para agrupar por esa columna';
  filtrosForm!: FormGroup;
  listaClientes: any[] = [];
  listaZonas: any[] = [];
  listaRutas: any[] = [];
  listaVariantes: any[] = [];
  informacion: any[] = [];

  public paginaActual: number = 1;
  public totalRegistros: number = 0;
  public pageSize: number = 20;
  public totalPaginas: number = 0;
  public data!: string;
  public paginaActualData: any[] = [];
  public filtroActivo: string = '';
  @ViewChild(DxDataGridComponent, { static: false }) dataGrid!: DxDataGridComponent;
  public autoExpandAllGroups: boolean = true;
  isGrouped: boolean = false;

  constructor(
    private alerts: AlertsService,
    private fb: FormBuilder,
    private reportesService: ReportesService,
    private clientesService: ClientesService,
    private zonasService: ZonasService,
    private rutasService: RutasService,
    private variantesService: VariantesService
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
      if (idRegion) {
        // Habilitar campo de rutas y cargar rutas de la zona
        this.filtrosForm.get('idRuta')?.enable();
        this.cargarRutasByZona(idRegion);
      } else {
        // Deshabilitar campos dependientes y limpiar valores
        this.filtrosForm.get('idRuta')?.disable();
        this.filtrosForm.get('idRuta')?.setValue(null);
        this.filtrosForm.get('idVariante')?.disable();
        this.filtrosForm.get('idVariante')?.setValue(null);
        this.listaRutas = [];
        this.listaVariantes = [];
      }
    });

    // Suscribirse a cambios en la ruta para habilitar/deshabilitar variantes
    this.filtrosForm.get('idRuta')?.valueChanges.subscribe((idRuta) => {
      if (idRuta) {
        // Habilitar campo de variantes y cargar variantes de la ruta
        this.filtrosForm.get('idVariante')?.enable();
        this.cargarVariantesByRuta(idRuta);
      } else {
        // Deshabilitar campo de variantes y limpiar valor
        this.filtrosForm.get('idVariante')?.disable();
        this.filtrosForm.get('idVariante')?.setValue(null);
        this.listaVariantes = [];
      }
    });
  }

  cargarListas(): void {
    // Cargar clientes
    this.clientesService.obtenerClientes().subscribe({
      next: (response: any) => {
        this.listaClientes = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
      },
      error: (error) => {
        console.error('Error al cargar clientes:');
      }
    });

    // No cargar zonas inicialmente, se cargarán cuando se seleccione un cliente
    this.listaZonas = [];

    // No cargar rutas inicialmente, se cargarán cuando se seleccione una zona
    this.listaRutas = [];

    // No cargar variantes inicialmente, se cargarán cuando se seleccione una ruta
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
   * Carga las rutas filtradas por zona
   */
  cargarRutasByZona(idZona: number): void {
    this.rutasService.obtenerRutasByZona(idZona).subscribe({
      next: (response: any) => {
        this.listaRutas = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
      },
      error: (error) => {
        console.error('Error al cargar rutas por zona:');
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

  aplicarFiltros(): void {
    this.loadingVisible = true;
    const formValue = this.filtrosForm.value;
    
    // Formatear fechas a YYYY-MM-DD
    const fechaInicio = formValue.fechaInicio 
      ? this.formatearFecha(formValue.fechaInicio) 
      : this.formatearFecha(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    
    const fechaFin = formValue.fechaFin 
      ? this.formatearFecha(formValue.fechaFin) 
      : this.formatearFecha(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));

    const payload = {
      fechaInicio: fechaInicio,
      fechaFin: fechaFin,
      idCliente: formValue.idCliente || null,
      idRuta: formValue.idRuta || null,
      idVariante: formValue.idVariante || null
    };

    this.reportesService.obtenerRecaudacionDiariaRuta(payload).subscribe({
      next: (response: any) => {
        this.loadingVisible = false;
        // Mapear la respuesta del API a la estructura esperada por el grid
        if (response && response.data && Array.isArray(response.data)) {
          this.informacion = response.data.map((item: any, index: number) => ({
            id: index + 1,
            fecha: item.fecha ? new Date(item.fecha) : new Date(),
            region: item.region || item.nombreRegion || '',
            ruta: item.ruta || item.nombreRuta || '',
            Variante: item.variante || item.nombreVariante || '',
            viajes: Number(item.viajes || item.totalViajes || 0),
            validaciones: Number(item.validaciones || item.totalValidaciones || 0),
            ingresosMxn: Number(item.ingresos ?? item.ingresosMxn ?? item.ingresosTotales ?? 0),
            ticketPromedio: Number(item.ticketPromedio || 0),
            porcentajeElectronico: Number(item.porcentajeElectronico || 0) / 100,
            evasionAbs: Number(item.evasionAbs || item.evasion || 0),
            evasionPorcentaje: Number(item.evasionPorcentaje || 0) / 100
          }));
        } else if (Array.isArray(response)) {
          this.informacion = response.map((item: any, index: number) => ({
            id: index + 1,
            fecha: item.fecha ? new Date(item.fecha) : new Date(),
            region: item.region || item.nombreRegion || '',
            ruta: item.ruta || item.nombreRuta || '',
            Variante: item.variante || item.nombreVariante || '',
            viajes: Number(item.viajes || item.totalViajes || 0),
            validaciones: Number(item.validaciones || item.totalValidaciones || 0),
            ingresosMxn: Number(item.ingresos ?? item.ingresosMxn ?? item.ingresosTotales ?? 0),
            ticketPromedio: Number(item.ticketPromedio || 0),
            porcentajeElectronico: Number(item.porcentajeElectronico || 0) / 100,
            evasionAbs: Number(item.evasionAbs || item.evasion || 0),
            evasionPorcentaje: Number(item.evasionPorcentaje || 0) / 100
          }));
        }
        
        if (this.dataGrid) {
          this.dataGrid.instance.refresh();
        }
      },
      error: (error: any) => {
        this.loadingVisible = false;
        console.error('Error al cargar reporte:');
        this.alerts.open({
          type: 'error',
          title: 'Error',
          message: error?.error?.message || 'No se pudo cargar el reporte. Por favor, intente nuevamente.',
          confirmText: 'Aceptar',
          backdropClose: false
        });
      }
    });
  }

  limpiarFiltros(): void {
    this.initForm();
    this.informacion = [];
    if (this.dataGrid) {
      this.dataGrid.instance.clearGrouping();
      this.isGrouped = false;
      this.dataGrid.instance.refresh();
    }
  }

  formatearFecha(fecha: Date): string {
    if (!fecha) return '';
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  limpiarCampos() {
    this.limpiarFiltros();
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