import { Component, OnInit, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { TalleresService } from 'src/app/pages/services/talleres.service';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';

@Component({
  selector: 'vex-lista-talleres',
  templateUrl: './lista-talleres.component.html',
  styleUrl: './lista-talleres.component.scss',
  animations: [fadeInRight400ms],
})
export class ListaTalleresComponent implements OnInit {
  layoutCtrl = new UntypedFormControl('fullwidth');
  listaTalleres: any;
  public showFilterRow: boolean;
  public showHeaderFilter: boolean;
  public loading!: boolean;
  public mensajeAgrupar: string = 'Arrastre un encabezado de columna aquí para agrupar por esa columna';
  public pageSize: number = 20;
  @ViewChild(DxDataGridComponent, { static: false }) dataGrid!: DxDataGridComponent;
  public autoExpandAllGroups: boolean = true;
  public paginaActualData: any[] = [];
  public filtroActivo: string = '';

  constructor(
    private talleresService: TalleresService,
    private router: Router,
    private alerts: AlertsService
  ) {
    this.showFilterRow = true;
    this.showHeaderFilter = true;
  }

  ngOnInit(): void {
    this.setupDataSource();
  }

  setupDataSource() {
    this.loading = true;
    this.listaTalleres = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const take = Number(loadOptions?.take) || this.pageSize || 10;
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;
        try {
          const resp: any = await lastValueFrom(
            this.talleresService.obtenerTalleresData(page, take)
          );
          this.loading = false;
          const rows: any[] = Array.isArray(resp?.data) ? resp.data : [];
          const meta = resp?.paginated || {};
          const totalRegistros =
            toNum(meta.total) ??
            toNum(resp?.total) ??
            rows.length;

          const dataTransformada = rows.map((item: any) => {
            const idNum = Number(item?.id ?? item?.Id ?? item?.ID ?? 0);
            return {
              ...item,
              // Normalizar id
              id: Number.isFinite(idNum) ? idNum : 0,
              Id: Number.isFinite(idNum) ? idNum : 0,
              // Normalizar campos con mayúsculas a minúsculas para consistencia
              nombre: item?.Nombre ?? item?.nombre ?? '',
              descripcion: item?.Descripcion ?? item?.descripcion ?? '',
              icono: item?.Icono ?? item?.icono ?? '',
              direccion: item?.Direccion ?? item?.direccion ?? '',
              lat: item?.Lat ?? item?.lat ?? null,
              lng: item?.Lng ?? item?.lng ?? null,
              estatus: item?.Estatus ?? item?.estatus ?? null,
              idCliente: Number(item?.IdCliente ?? item?.idCliente ?? 0),
              nombreCliente: item?.nombreCliente ?? '',
              fhRegistro: item?.FHRegistro ?? item?.fhRegistro ?? null,
              fhActualizacion: item?.FHActualizacion ?? item?.fhActualizacion ?? null
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
      grid?.option('dataSource', this.listaTalleres);
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
    } catch {}
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
    const groupedColumns = this.dataGrid.instance
      .getVisibleColumns()
      .filter((col) => (col.groupIndex ?? -1) >= 0);
    if (groupedColumns.length === 0) {
      return;
    } else {
      this.autoExpandAllGroups = !this.autoExpandAllGroups;
      this.dataGrid.instance.refresh();
    }
  }

  agregarRegistro() {
    this.router.navigateByUrl('/administracion/talleres/registrar-taller');
  }

  editarRegistro(id: number) {
    this.router.navigateByUrl(`/administracion/talleres/editar-taller/${id}`);
  }

  async activar(rowData: any) {
    const res = await this.alerts.open({
      type: 'warning',
      title: '¡Activar!',
      message: `¿Está seguro que requiere activar el taller: <strong>${rowData.nombre}</strong>?`,
      showCancel: true,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      backdropClose: false,
    });
    if (res !== 'confirm') return;

    this.talleresService.activarTaller(rowData.id).subscribe({
      next: () => {
        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'Se activó el taller de manera exitosa.',
          confirmText: 'Confirmar',
          backdropClose: false
        });
        this.dataGrid.instance.refresh();
      },
      error: (error) => {
        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: 'Ocurrió un error al activar el taller.',
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
      message: `¿Está seguro que requiere desactivar el taller: <strong>${rowData.nombre}</strong>?`,
      showCancel: true,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      backdropClose: false,
    });
    if (res !== 'confirm') return;

    this.talleresService.desactivarTaller(rowData.id).subscribe({
      next: () => {
        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'Se desactivó el taller de manera exitosa.',
          confirmText: 'Confirmar',
          backdropClose: false
        });
        this.dataGrid.instance.refresh();
      },
      error: (error) => {
        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: 'Ocurrió un error al desactivar el taller.',
          confirmText: 'Confirmar',
          backdropClose: false
        });
        console.error('Error:');
      }
    });
  }
}
