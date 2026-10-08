import { mensajeDeError } from 'src/app/core/utils/mensaje-error';
import { Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { ContadoraService } from 'src/app/pages/services/contadora.service';
import { DispositivoBluevoxService } from 'src/app/pages/services/dispositivobluevox.service';
import { UsuariosService } from 'src/app/pages/services/usuarios.service';
import { MatDialog } from '@angular/material/dialog';
import { CambiarEstadoModalComponent, CambiarEstadoData } from '../../dispositivos/cambiar-estado-modal/cambiar-estado-modal.component';

@Component({
  selector: 'vex-lista-contadora',
  templateUrl: './lista-contadora.component.html',
  styleUrl: './lista-contadora.component.scss',
  animations: [fadeInRight400ms],
})
export class ListaContadoraComponent implements OnInit {

  layoutCtrl = new UntypedFormControl('fullwidth');
  estadoLabel: Record<number, string> = {
    0: 'Inactivo',
    1: 'Disponible',
    2: 'Asignado',
    3: 'En mantenimiento',
    4: 'Dañado',
    5: 'Retirado'
  };

  estadoClass: Record<number, string> = {
    0: 'ea-inactivo',
    1: 'ea-disponible',
    2: 'ea-asignado',
    3: 'ea-mantenimiento',
    4: 'ea-danado',
    5: 'ea-retirado'
  };
  isLoading: boolean = false;
  listaDispositivos: any;
  public grid: boolean = false;
  public showFilterRow: boolean;
  public showHeaderFilter: boolean;
  public loadingVisible: boolean = false;
  public mensajeAgrupar: string = "Arrastre un encabezado de columna aquí para agrupar por esa columna";
  public loading!: boolean;
  public loadingMessage: string = 'Cargando...';
  public paginaActual: number = 1;
  public totalRegistros: number = 0;
  public pageSize: number = 20;
  public totalPaginas: number = 0;
  @ViewChild(DxDataGridComponent, { static: false }) dataGrid!: DxDataGridComponent;
  public autoExpandAllGroups: boolean = true;
  isGrouped: boolean = false;
  public paginaActualData: any[] = [];
  public filtroActivo: string = '';

  constructor(
    private disBlueService: DispositivoBluevoxService,
    private contadoraService: ContadoraService,
    private alerts: AlertsService,
    private route: Router,
    private dialog: MatDialog
  ) {
    this.showFilterRow = true;
    this.showHeaderFilter = true;
  }

  ngOnInit(): void {
    this.obtenerDispositivos();
  }

  // hasPermission(permission: string): boolean {
  //   return this.permissionsService.getPermission(permission) !== undefined;
  // }

  obtenerDispositivos() {
    this.loading = true;
    this.listaDispositivos = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const skip = Number(loadOptions?.skip) || 0;
        const take = Number(loadOptions?.take) || this.pageSize;
        const page = Math.floor(skip / take) + 1;
        try {
          const response: any = await lastValueFrom(
            this.disBlueService.obtenerDispositivosBlueData(page, take)
          );
          this.loading = false;
          const totalRegistros = Number(response?.paginated?.total) || 0;
          const paginaActual = Number(response?.paginated?.page) || page;
          const totalPaginas = take > 0 ? Math.ceil(totalRegistros / take) : 0;
          this.totalRegistros = totalRegistros;
          this.paginaActual = paginaActual;
          this.totalPaginas = totalPaginas;
          const dataTransformada = (Array.isArray(response?.data) ? response.data : [])
            .map((item: any) => {
              const idNum = Number(item?.id ?? item?.Id ?? item?.ID);
              return {
                ...item,
                id: Number.isFinite(idNum) ? idNum : 0,
              };
            })
            .sort((a: any, b: any) => b.id - a.id);
          this.paginaActualData = dataTransformada;
          return {
            data: dataTransformada,
            totalCount: totalRegistros
          };
        } catch (error) {
          this.loading = false;
          console.error('Error en la solicitud de datos:');
          return { data: [], totalCount: 0 };
        }
      }
    });
  }

  onGridOptionChanged(e: any) {
    if (e.fullName !== 'searchPanel.text') return;

    const grid = this.dataGrid?.instance;
    const qRaw = (e.value ?? '').toString().trim();
    if (!qRaw) {
      this.filtroActivo = '';
      grid?.option('dataSource', this.listaDispositivos);
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

      const estNum = Number(row?.estatus);
      const estText = Number.isFinite(estNum) ? (estNum === 1 ? 'activo' : 'inactivo') : '';

      const estHits =
        estText.includes(q) ||
        ('activo'.startsWith(q) && estNum === 1) ||
        ('inactivo'.startsWith(q) && estNum === 0) ||
        (q === '1' && estNum === 1) ||
        (q === '0' && estNum === 0) ||
        String(estNum).includes(q);

      const hitExtras = [
        norm(row?.id),
        norm(row?.marca),
        norm(row?.modelo),
        norm(row?.numeroSerie)
      ].some((s) => s.includes(q));

      return hitCols || estHits || hitExtras;
    });

    grid?.option('dataSource', dataFiltrada);
  }


  onPageIndexChanged(e: any) {
    const pageIndex = e.component.pageIndex();
    this.paginaActual = pageIndex + 1;
    e.component.refresh();
  }

  showInfo(id: any): void {
  }

  actualizarContadora(idContadora: number) {
    this.route.navigateByUrl('/administracion/contadora/editar-contadora/' + idContadora);
  };

  async activar(rowData: any) {
  const res = await this.alerts.open({
    type: 'warning',
    title: '¡Activar!',
    message: `¿Está seguro que requiere activar la contadora: <strong>${rowData.marca}</strong>?`,
    showCancel: true,
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    backdropClose: false,
  });

  if (res !== 'confirm') return;

  this.disBlueService.updateEstatus(rowData.id, 1).subscribe(
    () => {
      this.alerts.open({
        type: 'success',
        title: '¡Confirmación Realizada!',
        message: 'La contadora ha sido activada.',
        confirmText: 'Confirmar',
        backdropClose: false,
      });
      this.obtenerDispositivos();
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
    message: `¿Está seguro que requiere desactivar la contadora: <strong>${rowData.marca}</strong>?`,
    showCancel: true,
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    backdropClose: false,
  });

  if (res !== 'confirm') return;

  this.disBlueService.updateEstatus(rowData.id, 0).subscribe(
    () => {
      this.alerts.open({
        type: 'success',
        title: '¡Confirmación Realizada!',
        message: 'La contadora ha sido desactivada.',
        confirmText: 'Confirmar',
        backdropClose: false,
      });
      this.obtenerDispositivos();
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

agregarContadora(){
    this.route.navigateByUrl('/administracion/contadora/agregar-contadora')
  }

  limpiarCampos() {
    const today = new Date();
    this.dataGrid.instance.clearGrouping();
    this.isGrouped = false;
    this.obtenerDispositivos();
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

  intercambiar(rowData: any) {
    const data: CambiarEstadoData = {
      numeroSerie: rowData.numeroSerie || 'N/A',
      estadoActual: rowData.estadoActual || 0,
      tipoDispositivo: 'contador'
    };

    const dialogRef = this.dialog.open(CambiarEstadoModalComponent, {
      width: '450px',
      disableClose: true,
      data: data
    });

    dialogRef.afterClosed().subscribe((nuevoEstado: number | undefined) => {
      if (nuevoEstado !== undefined && nuevoEstado !== null) {
        this.contadoraService.actualizarEstado(rowData.id, nuevoEstado).subscribe({
          next: () => {
            this.alerts.open({
              type: 'success',
              title: '¡Estado Actualizado!',
              message: `El estado del contador ha sido actualizado correctamente.`,
              confirmText: 'Confirmar',
              backdropClose: false
            });
            this.obtenerDispositivos();
            this.dataGrid.instance.refresh();
          },
          error: (error) => {
            this.alerts.open({
              type: 'error',
              title: '¡Ops!',
              message: mensajeDeError(error),
              confirmText: 'Confirmar',
              backdropClose: false
            });
          }
        });
      }
    });
  }

}
