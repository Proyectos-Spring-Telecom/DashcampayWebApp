import { Component, OnInit, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { MantenimientosService } from 'src/app/pages/services/mantenimientos.service';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { MatDialog } from '@angular/material/dialog';
import { CambiarEstadoMantenimientoModalComponent, CambiarEstadoMantenimientoData } from '../cambiar-estado-mantenimiento-modal/cambiar-estado-mantenimiento-modal.component';
import { EstadoMantenimientoVehicular, EstadoMantenimientoVehicularLabels } from 'src/app/entities/estado-mantenimiento-vehicular.enum';

@Component({
  selector: 'vex-incidentes',
  standalone: false,
  templateUrl: './incidentes.component.html',
  styleUrl: './incidentes.component.scss',
  animations: [fadeInRight400ms],
})
export class IncidentesComponent implements OnInit {

  layoutCtrl = new UntypedFormControl('fullwidth');
  listaIncidentes: any;
  public showFilterRow: boolean;
  public showHeaderFilter: boolean;
  public loading!: boolean;
  public mensajeAgrupar: string = 'Arrastre un encabezado de columna aquí para agrupar por esa columna';
  public pageSize: number = 20;
  @ViewChild(DxDataGridComponent, { static: false }) dataGrid!: DxDataGridComponent;
  public autoExpandAllGroups: boolean = true;
  public paginaActualData: any[] = [];
  public filtroActivo: string = '';
  public EstadoMantenimientoVehicular = EstadoMantenimientoVehicular;
  public EstadoMantenimientoVehicularLabels = EstadoMantenimientoVehicularLabels;

  constructor(
    private mantenimientosService: MantenimientosService,
    private router: Router,
    private alerts: AlertsService,
    private dialog: MatDialog
  ) {
    this.showFilterRow = true;
    this.showHeaderFilter = true;
  }

  ngOnInit(): void {
    this.setupDataSource();
  }

  setupDataSource() {
    this.loading = true;
    this.listaIncidentes = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const take = Number(loadOptions?.take) || this.pageSize || 10;
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;
        try {
          const resp: any = await lastValueFrom(
            this.mantenimientosService.obtenerIncidentesData(page, take)
          );
          this.loading = false;
          const rows: any[] = Array.isArray(resp?.data) ? resp.data : [];
          const meta = resp?.paginated || {};
          const totalRegistros =
            toNum(meta.total) ??
            toNum(resp?.total) ??
            rows.length;

          const dataTransformada = rows.map((item: any) => {
            // Priorizar idEstatus del API (campo que se actualiza con el endpoint /incidentes/{id}/estatus/{estatus})
            const idEstatus = Number(item?.idEstatus ?? item?.IdEstatus ?? item?.ID_ESTATUS ?? item?.id_estatus ?? item?.estatusIncidente?.id ?? item?.estatusIncidente?.Id ?? 1);
            return {
              ...item,
              // Normalizar campos
              id: Number(item?.id ?? item?.Id ?? 0),
              placaVehiculo: item?.placaVehiculo ?? item?.PlacaVehiculo ?? '',
              nombreOperador: item?.nombreOperador ?? item?.NombreOperador ?? '',
              nombreCliente: item?.nombreCliente ?? item?.NombreCliente ?? item?.cliente?.nombre ?? item?.cliente?.Nombre ?? '',
              imagenVehiculo: item?.imagenVehiculo ?? item?.ImagenVehiculo ?? null,
              imagen: item?.imagen ?? item?.Imagen ?? item?.captura ?? item?.Captura ?? item?.imagenCaptura ?? item?.ImagenCaptura ?? null,
              // idEstatus es el campo que se actualiza con /incidentes/{id}/estatus/{estatus}
              idEstatus: Number.isFinite(idEstatus) ? idEstatus : 1,
              nombreEstatus: EstadoMantenimientoVehicularLabels[idEstatus] ?? 'N/A',
              incidente: item?.incidente ?? item?.Incidente ?? item?.descripcionIncidente ?? item?.DescripcionIncidente ?? item?.descripcion ?? item?.Descripcion ?? '',
              // estatus es para activar/desactivar (activo/inactivo)
              estatus: Number(item?.estatus ?? item?.Estatus ?? 1)
            };
          });
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
    if (e.fullName !== 'searchPanel.text') return;

    const grid = this.dataGrid?.instance;
    const qRaw = (e.value ?? '').toString().trim();
    if (!qRaw) {
      this.filtroActivo = '';
      grid?.option('dataSource', this.listaIncidentes);
      return;
    }
    this.filtroActivo = qRaw;

    const norm = (v: any) =>
      (v == null ? '' : String(v))
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();
    const q = norm(qRaw);

    let columnas: any[] = [];
    try {
      const colsOpt = grid?.option('columns');
      if (Array.isArray(colsOpt) && colsOpt.length) columnas = colsOpt;
    } catch { }
    if (!columnas.length && grid?.getVisibleColumns) columnas = grid.getVisibleColumns();

    const dataFields: string[] = columnas
      .map((c: any) => c?.dataField)
      .filter((df: any) => typeof df === 'string' && df.trim().length > 0);

    const getByPath = (obj: any, path: string) =>
      !obj || !path ? undefined : path.split('.').reduce((acc, k) => acc?.[k], obj);

    const dataFiltrada = (this.paginaActualData || []).filter((row: any) => {
      const hitCols = dataFields.some((df) => norm(getByPath(row, df)).includes(q));
      return hitCols;
    });

    grid?.option('dataSource', dataFiltrada);
  }

  limpiarCampos() {
    this.dataGrid.instance.clearGrouping();
    this.setupDataSource();
    this.dataGrid.instance.refresh();
  }

  toggleExpandGroups() {
    const groupedColumns = this.dataGrid.instance.getVisibleColumns()
      .filter(col => (col.groupIndex ?? -1) >= 0);
    if (groupedColumns.length === 0) {
      return;
    } else {
      this.autoExpandAllGroups = !this.autoExpandAllGroups;
      this.dataGrid.instance.refresh();
    }
  }

  agregarRegistro() {
    this.router.navigate(['/administracion/incidentes/registrar-incidente']);
  }

  editarRegistro(id: number) {
    this.router.navigate(['/administracion/incidentes/registrar-incidente', id]);
  }

  verCaptura(url: string) {
    if (!url) return;
    window.open(url, '_blank');
  }

  async activar(rowData: any) {
    const res = await this.alerts.open({
      type: 'warning',
      title: '¡Activar!',
      message: `¿Está seguro que requiere activar el incidente con placa: <strong>${rowData.placaVehiculo || 'N/A'}</strong>?`,
      showCancel: true,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      backdropClose: false,
    });
    if (res !== 'confirm') return;

    this.mantenimientosService.activarIncidente(rowData.id).subscribe({
      next: () => {
        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'Se activó el incidente de manera exitosa.',
          confirmText: 'Confirmar',
          backdropClose: false
        });
        this.dataGrid.instance.refresh();
      },
      error: (error) => {
        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: 'Ocurrió un error al activar el incidente.',
          confirmText: 'Confirmar',
          backdropClose: false
        });
        console.error('Error:');
      }
    });
  }

  async desactivar(rowData: any) {
    const res = await this.alerts.open({
      type: 'warning',
      title: '¡Desactivar!',
      message: `¿Está seguro que requiere desactivar el incidente con placa: <strong>${rowData.placaVehiculo || 'N/A'}</strong>?`,
      showCancel: true,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      backdropClose: false,
    });
    if (res !== 'confirm') return;

    this.mantenimientosService.desactivarIncidente(rowData.id).subscribe({
      next: () => {
        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'Se desactivó el incidente de manera exitosa.',
          confirmText: 'Confirmar',
          backdropClose: false
        });
        this.dataGrid.instance.refresh();
      },
      error: (error) => {
        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: 'Ocurrió un error al desactivar el incidente.',
          confirmText: 'Confirmar',
          backdropClose: false
        });
        console.error('Error:');
      }
    });
  }

  cambiarEstatusIncidente(rowData: any) {
    const data: CambiarEstadoMantenimientoData = {
      placaVehiculo: rowData.placaVehiculo || 'N/A',
      estadoActual: rowData.idEstatus || 1
    };

    const dialogRef = this.dialog.open(CambiarEstadoMantenimientoModalComponent, {
      width: '450px',
      disableClose: true,
      data: data
    });

    dialogRef.afterClosed().subscribe((nuevoEstado: number | undefined) => {
      if (nuevoEstado !== undefined && nuevoEstado !== null) {
        this.mantenimientosService.actualizarEstatusIncidente(rowData.id, nuevoEstado).subscribe({
          next: () => {
            this.alerts.open({
              type: 'success',
              title: '¡Estado Actualizado!',
              message: `El estado del incidente ha sido actualizado correctamente.`,
              confirmText: 'Confirmar',
              backdropClose: false
            });
            this.dataGrid.instance.refresh();
          },
          error: (error) => {
            this.alerts.open({
              type: 'error',
              title: '¡Ops!',
              message: 'Ocurrió un error al actualizar el estado del incidente.',
              confirmText: 'Confirmar',
              backdropClose: false
            });
            console.error('Error:');
          }
        });
      }
    });
  }
}
