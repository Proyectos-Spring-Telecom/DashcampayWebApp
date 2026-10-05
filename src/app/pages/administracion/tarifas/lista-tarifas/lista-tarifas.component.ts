import { Component, OnInit, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { TarifasService } from 'src/app/pages/services/tarifa.service';

@Component({
  selector: 'vex-lista-tarifas',
  templateUrl: './lista-tarifas.component.html',
  styleUrl: './lista-tarifas.component.scss'
})
export class ListaTarifasComponent implements OnInit {

  layoutCtrl = new UntypedFormControl('fullwidth');
  isLoading: boolean = false;
  public listaTarifas: any;
  public grid: boolean = false;
  public showFilterRow: boolean;
  public showHeaderFilter: boolean;
  public loadingVisible: boolean = false;
  public mensajeAgrupar: string = 'Arrastre un encabezado de columna aquí para agrupar por esa columna';
  public loading!: boolean;
  public loadingMessage: string = 'Cargando...';
  public autoExpandAllGroups: boolean = true;
  isGrouped: boolean = false;
  public paginaActual: number = 1;
  public totalRegistros: number = 0;
  public pageSize: number = 20;
  public totalPaginas: number = 0;
  public data!: string;
  public paginaActualData: any[] = [];
  public filtroActivo: string = '';
  @ViewChild(DxDataGridComponent, { static: false }) dataGrid!: DxDataGridComponent;

  constructor(private tariService: TarifasService, private route: Router, private alerts: AlertsService) {
    this.showFilterRow = true;
    this.showHeaderFilter = true;
  }

  ngOnInit() {
    this.setupDataSource();
    // this.obtenerlistaTarifas();
  }

  // hasPermission(permission: string): boolean {
  //   return this.permissionsService.getPermission(permission) !== undefined;
  // }

  setupDataSource() {
    this.loading = true;

    this.listaTarifas = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const take = Number(loadOptions?.take) || this.pageSize || 10;
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;

        try {
          const resp: any = await lastValueFrom(
            this.tariService.obtenerTarifasData(page, take)
          );
          this.loading = false;
          let rows: any[] = Array.isArray(resp?.data) ? resp.data : [];
          const meta = resp?.paginated || {};
          const totalRegistros =
            toNum(meta.total) ?? toNum(resp?.total) ?? rows.length;
          const paginaActual =
            toNum(meta.page) ?? toNum(resp?.page) ?? page;
          const totalPaginas =
            toNum(meta.lastPage) ?? toNum(resp?.pages) ??
            Math.max(1, Math.ceil(totalRegistros / take));

          const dataTransformada = rows.map((item: any) => ({
            ...item,
            estatusTexto:
              Number(item?.estatus) === 1 ? 'Activo' :
                Number(item?.estatus) === 0 ? 'Inactivo' : null
          }));

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
        this.dataGrid.instance.option('dataSource', this.listaTarifas);
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

  agregarTarifa() {
    this.route.navigateByUrl('/administracion/tarifas/agregar-tarifa')
  }

  actualizarTarifa(idTarifa: number) {
    this.route.navigateByUrl('/administracion/tarifas/editar-tarifa/' + idTarifa);
  };


  async eliminarDerrotero(rowData: any) {
    const res = await this.alerts.open({
      type: 'warning',
      title: '¡Eliminar!',
      message: `¿Está seguro que requiere eliminar la tarifa?`,
      showCancel: true,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      backdropClose: false,
    });
    if (res !== 'confirm') return;

    this.tariService.eliminarTarifa(rowData.id).subscribe(
      () => {
        this.alerts.open({
          type: 'success',
          title: '¡Confirmación Realizada!',
          message: 'La tarifa ha sido eliminada.',
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

  async activar(rowData: any) {
    const res = await this.alerts.open({
      type: 'warning',
      title: '¡Activar!',
      message: `¿Está seguro que requiere activar la tarifa: <strong>${rowData.nombreRuta}</strong>?`,
      showCancel: true,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      backdropClose: false,
    });
    if (res !== 'confirm') return;

    this.tariService.updateEstatus(rowData.id, 1).subscribe(
      () => {
        this.alerts.open({
          type: 'success',
          title: '¡Confirmación Realizada!',
          message: 'La tarifa ha sido activada.',
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
      message: `¿Está seguro que requiere desactivar la tarifa: <strong>${rowData.nombreRuta}</strong>?`,
      showCancel: true,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      backdropClose: false,
    });
    if (res !== 'confirm') return;

    this.tariService.updateEstatus(rowData.id, 0).subscribe(
      () => {
        this.alerts.open({
          type: 'success',
          title: '¡Confirmación Realizada!',
          message: 'La tarifa ha sido desactivada.',
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

}
