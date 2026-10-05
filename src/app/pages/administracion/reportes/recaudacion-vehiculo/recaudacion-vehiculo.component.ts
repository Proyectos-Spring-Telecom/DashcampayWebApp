import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, UntypedFormControl } from '@angular/forms';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { DxDataGridComponent } from 'devextreme-angular';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { ReportesService } from 'src/app/pages/services/reportes.service';
import { ClientesService } from 'src/app/pages/services/clientes.service';
import { VehiculosService } from 'src/app/pages/services/vehiculos.service';
import { RutasService } from 'src/app/pages/services/ruta.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'vex-recaudacion-vehiculo',
  templateUrl: './recaudacion-vehiculo.component.html',
  styleUrl: './recaudacion-vehiculo.component.scss',
  animations: [fadeInRight400ms],
})
export class RecaudacionVehiculoComponent implements OnInit {

  layoutCtrl = new UntypedFormControl('fullwidth');
    public showFilterRow: boolean;
    public showHeaderFilter: boolean;
    public loadingVisible: boolean = false;
    public mensajeAgrupar: string = 'Arrastre un encabezado de columna aquí para agrupar por esa columna';
    filtrosForm!: FormGroup;
    listaClientes: any[] = [];
    listaVehiculos: any[] = [];
    listaRutas: any[] = [];
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
      private vehiculosService: VehiculosService,
      private rutasService: RutasService
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
        idVehiculo: [{value: null, disabled: true}],
        idRuta: [{value: null, disabled: true}]
      });
    }
  
    ngOnInit(): void {
      this.cargarListas();
      
      // Suscribirse a cambios en el cliente para habilitar/deshabilitar vehículos y rutas
      this.filtrosForm.get('idCliente')?.valueChanges.subscribe((idCliente) => {
        // Limpiar siempre los filtros dependientes cuando cambia el cliente
        this.filtrosForm.get('idVehiculo')?.setValue(null, { emitEvent: false });
        this.filtrosForm.get('idRuta')?.setValue(null, { emitEvent: false });
        this.listaVehiculos = [];
        this.listaRutas = [];

        if (idCliente) {
          // Habilitar campos y cargar vehículos y rutas simultáneamente
          this.filtrosForm.get('idVehiculo')?.enable();
          this.filtrosForm.get('idRuta')?.enable();
          this.cargarVehiculosYRutasByCliente(idCliente);
        } else {
          // Deshabilitar campos dependientes
          this.filtrosForm.get('idVehiculo')?.disable();
          this.filtrosForm.get('idRuta')?.disable();
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

      // No cargar vehículos y rutas inicialmente, se cargarán cuando se seleccione un cliente
      this.listaVehiculos = [];
      this.listaRutas = [];
    }

    /**
     * Carga vehículos y rutas simultáneamente por cliente
     */
    cargarVehiculosYRutasByCliente(idCliente: number): void {
      // Ejecutar ambas peticiones simultáneamente usando forkJoin
      forkJoin({
        vehiculos: this.vehiculosService.obtenerVehiculosByCliente(idCliente),
        rutas: this.rutasService.obtenerRutasByIdCliente(idCliente)
      }).subscribe({
        next: ({ vehiculos, rutas }) => {
          // Procesar respuesta de vehículos
          this.listaVehiculos = Array.isArray(vehiculos?.data) 
            ? vehiculos.data 
            : (Array.isArray(vehiculos) ? vehiculos : []);

          // Procesar respuesta de rutas
          this.listaRutas = Array.isArray(rutas?.data) 
            ? rutas.data 
            : (Array.isArray(rutas) ? rutas : []);
        },
        error: (error) => {
          console.error('Error al cargar vehículos y rutas por cliente:');
          this.listaVehiculos = [];
          this.listaRutas = [];
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
        idVehiculo: formValue.idVehiculo || null,
        idRuta: formValue.idRuta || null
      };

      this.reportesService.obtenerRecaudacionPorVehiculo(payload).subscribe({
        next: (response: any) => {
          this.loadingVisible = false;
          // Mapear la respuesta del API a la estructura esperada por el grid
          if (response && response.data && Array.isArray(response.data)) {
            this.informacion = response.data.map((item: any, index: number) => ({
              id: index + 1,
              noEconomico: item.noEconomico || item.numeroEconomico || '',
              placa: item.placa || '',
              marcaModeloAnio: item.marcaModeloAnio || (item.marca || '') + ' ' + (item.modelo || '') + ' ' + (item.anio || ''),
              turnos: Number(item.turnos || item.totalTurnos || 0),
              viajes: Number(item.viajes || item.totalViajes || 0),
              validaciones: Number(item.validaciones || item.totalValidaciones || 0),
              ingresos: Number(item.ingresos || item.ingresosTotales || 0),
              ticketPromedio: Number(item.ticketPromedio || 0),
              horasServicio: Number(item.horasServicio || item.horasEnServicio || 0)
            }));
          } else if (Array.isArray(response)) {
            this.informacion = response.map((item: any, index: number) => ({
              id: index + 1,
              noEconomico: item.noEconomico || item.numeroEconomico || '',
              placa: item.placa || '',
              marcaModeloAnio: item.marcaModeloAnio || (item.marca || '') + ' ' + (item.modelo || '') + ' ' + (item.anio || ''),
              turnos: Number(item.turnos || item.totalTurnos || 0),
              viajes: Number(item.viajes || item.totalViajes || 0),
              validaciones: Number(item.validaciones || item.totalValidaciones || 0),
              ingresos: Number(item.ingresos || item.ingresosTotales || 0),
              ticketPromedio: Number(item.ticketPromedio || 0),
              horasServicio: Number(item.horasServicio || item.horasEnServicio || 0)
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