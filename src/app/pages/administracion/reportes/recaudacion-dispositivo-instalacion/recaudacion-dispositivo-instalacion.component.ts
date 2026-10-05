import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, UntypedFormControl } from '@angular/forms';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { DxDataGridComponent } from 'devextreme-angular';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { ReportesService } from 'src/app/pages/services/reportes.service';
import { ClientesService } from 'src/app/pages/services/clientes.service';
import { DispositivosService } from 'src/app/pages/services/dispositivos.service';
import { InstalacionesService } from 'src/app/pages/services/instalaciones.service';

@Component({
  selector: 'vex-recaudacion-dispositivo-instalacion',
  templateUrl: './recaudacion-dispositivo-instalacion.component.html',
  styleUrl: './recaudacion-dispositivo-instalacion.component.scss',
  animations: [fadeInRight400ms],
})
export class RecaudacionDispositivoInstalacionComponent implements OnInit {

   layoutCtrl = new UntypedFormControl('fullwidth');
      public showFilterRow: boolean;
      public showHeaderFilter: boolean;
      public loadingVisible: boolean = false;
      public mensajeAgrupar: string = 'Arrastre un encabezado de columna aquí para agrupar por esa columna';
      filtrosForm!: FormGroup;
      listaClientes: any[] = [];
      listaValidadores: any[] = [];
      listaInstalaciones: any[] = [];
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
        private dispositivosService: DispositivosService,
        private instalacionesService: InstalacionesService
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
          idValidador: [{value: null, disabled: true}],
          idInstalacion: [{value: null, disabled: true}]
        });
      }
    
      ngOnInit(): void {
        this.cargarListas();
        
        // Suscribirse a cambios en el cliente para habilitar/deshabilitar validadores
        this.filtrosForm.get('idCliente')?.valueChanges.subscribe((idCliente) => {
          // Limpiar siempre los filtros dependientes cuando cambia el cliente
          this.filtrosForm.get('idValidador')?.setValue(null, { emitEvent: false });
          this.filtrosForm.get('idInstalacion')?.setValue(null, { emitEvent: false });
          this.listaValidadores = [];
          this.listaInstalaciones = [];

          if (idCliente) {
            // Habilitar campo de validadores y cargar validadores del cliente
            this.filtrosForm.get('idValidador')?.enable();
            this.cargarValidadoresByCliente(idCliente);
          } else {
            // Deshabilitar campos dependientes
            this.filtrosForm.get('idValidador')?.disable();
            this.filtrosForm.get('idInstalacion')?.disable();
          }
        });

        // Suscribirse a cambios en el validador para habilitar/deshabilitar instalaciones
        this.filtrosForm.get('idValidador')?.valueChanges.subscribe((idValidador) => {
          // Limpiar siempre el filtro de instalación cuando cambia el validador
          this.filtrosForm.get('idInstalacion')?.setValue(null, { emitEvent: false });
          this.listaInstalaciones = [];

          if (idValidador) {
            // Habilitar campo de instalaciones y cargar instalaciones del validador
            this.filtrosForm.get('idInstalacion')?.enable();
            this.cargarInstalacionesByValidador(idValidador);
          } else {
            // Deshabilitar campo de instalaciones
            this.filtrosForm.get('idInstalacion')?.disable();
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

        // No cargar validadores e instalaciones inicialmente, se cargarán cuando se seleccione un cliente/validador
        this.listaValidadores = [];
        this.listaInstalaciones = [];
      }

      /**
       * Carga los validadores filtrados por cliente
       */
      cargarValidadoresByCliente(idCliente: number): void {
        this.dispositivosService.obtenerDispositivosByCliente(idCliente).subscribe({
          next: (response: any) => {
            this.listaValidadores = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
          },
          error: (error) => {
            console.error('Error al cargar validadores por cliente:');
            this.listaValidadores = [];
          }
        });
      }

      /**
       * Carga las instalaciones filtradas por validador
       */
      cargarInstalacionesByValidador(idValidador: number): void {
        this.instalacionesService.obtenerInstalacionesByValidador(idValidador).subscribe({
          next: (response: any) => {
            this.listaInstalaciones = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
          },
          error: (error) => {
            console.error('Error al cargar instalaciones por validador:');
            this.listaInstalaciones = [];
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
          idValidador: formValue.idValidador || null,
          idInstalacion: formValue.idInstalacion || null
        };

        this.reportesService.obtenerRecaudacionPorDispositivo(payload).subscribe({
          next: (response: any) => {
            this.loadingVisible = false;
            // Mapear la respuesta del API a la estructura esperada por el grid
            if (response && response.data && Array.isArray(response.data)) {
              this.informacion = response.data.map((item: any, index: number) => ({
                id: index + 1,
                serieDispositivo: item.serieDispositivo || item.numeroSerie || item.numeroSerieValidador || '',
                serieBlueVox: item.serieBlueVox || item.serieContador || item.numeroSerieContador || item.numeroSerieBlueVox || '',
                vehiculo: item.vehiculo || (item.placa || '') + ' ' + (item.numeroEconomico || '') || '',
                validaciones: Number(item.validaciones || item.totalValidaciones || 0),
                ingresos: Number(item.ingresos ?? item.ingresosTotales ?? 0),
                ultimaPosicion: this.formatUltimaPosicion(item.ultimaPosicion || item.ubicacion),
                estado: item.estado || item.estatus || 'Operativo'
              }));
            } else if (Array.isArray(response)) {
              this.informacion = response.map((item: any, index: number) => ({
                id: index + 1,
                serieDispositivo: item.serieDispositivo || item.numeroSerie || item.numeroSerieValidador || '',
                serieBlueVox: item.serieBlueVox || item.serieContador || item.numeroSerieContador || item.numeroSerieBlueVox || '',
                vehiculo: item.vehiculo || (item.placa || '') + ' ' + (item.numeroEconomico || '') || '',
                validaciones: Number(item.validaciones || item.totalValidaciones || 0),
                ingresos: Number(item.ingresos ?? item.ingresosTotales ?? 0),
                ultimaPosicion: this.formatUltimaPosicion(item.ultimaPosicion || item.ubicacion),
                estado: item.estado || item.estatus || 'Operativo'
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

      /**
       * Convierte el objeto ultimaPosicion del API en texto legible para la columna.
       * API: { latitud, longitud, fecha }
       */
      formatUltimaPosicion(obj: any): string {
        if (obj == null) return '—';
        if (typeof obj === 'string') return obj;
        const lat = Number(obj.latitud ?? obj.lat ?? NaN);
        const lng = Number(obj.longitud ?? obj.lng ?? NaN);
        const fechaRaw = obj.fecha ?? obj.fechaHora;
        let coord = '';
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          coord = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
        let fechaStr = '';
        if (fechaRaw) {
          try {
            const d = new Date(fechaRaw);
            if (!Number.isNaN(d.getTime())) {
              fechaStr = d.toLocaleString('es-MX', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
            }
          } catch {
            fechaStr = String(fechaRaw);
          }
        }
        if (coord && fechaStr) return `${coord} · ${fechaStr}`;
        if (coord) return coord;
        if (fechaStr) return fechaStr;
        return '—';
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