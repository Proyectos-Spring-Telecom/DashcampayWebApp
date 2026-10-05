import { Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { PermisosService } from 'src/app/pages/services/permisos.service';

@Component({
  selector: 'vex-lista-permisos',
  templateUrl: './lista-permisos.component.html',
  styleUrl: './lista-permisos.component.scss',
  animations: [fadeInRight400ms],
})
export class ListaPermisosComponent implements OnInit {

  layoutCtrl = new UntypedFormControl('fullwidth');
  isLoading: boolean = false;
  public listaPermisos: any;
  public grid: boolean = false;
  public showFilterRow: boolean;
  public showHeaderFilter: boolean;
  public loadingVisible: boolean = false;
  public mensajeAgrupar: string = 'Arrastre un encabezado de columna aquí para agrupar por esa columna';
  public loading!: boolean;
  public loadingMessage: string = 'Cargando...';

  public paginaActual: number = 1;
  public totalRegistros: number = 0;
  public pageSize: number = 100;
  public totalPaginas: number = 0;
  public data!: string;
  public paginaActualData: any[] = [];
  public filtroActivo: string = '';
  @ViewChild(DxDataGridComponent, { static: false }) dataGrid!: DxDataGridComponent;
  public autoExpandAllGroups: boolean = true;
  isGrouped: boolean = false;

  constructor(
    private permService: PermisosService,
    private route: Router,
    private alerts: AlertsService,
  ) {
    this.showFilterRow = true;
    this.showHeaderFilter = true;
  }

  ngOnInit() {
    this.setupDataSource();
    // this.obtenerListaPermisos();
  }

  // hasPermission(permission: string): boolean {
  //   return this.permissionsService.getPermission(permission) !== undefined;
  // }

  setupDataSource() {
    this.loading = true;

    this.listaPermisos = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const take = Math.min(Number(loadOptions?.take) || this.pageSize || 10, 100);
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;

        try {
          const resp: any = await lastValueFrom(
            this.permService.obtenerPermisosData(page, take)
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
            id: Number(item?.id ?? item?.Id),
            estatusTexto:
              Number(item?.estatus) === 1 ? 'Activo' :
                Number(item?.estatus) === 0 ? 'Inactivo' : null
          }));

          const sortedData = this.applySort(dataTransformada, loadOptions?.sort);

          this.totalRegistros = totalRegistros;
          this.paginaActual = paginaActual;
          this.totalPaginas = totalPaginas;
          this.paginaActualData = sortedData;

          return {
            data: sortedData,
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

  private applySort(data: any[], sort: any): any[] {
    if (!Array.isArray(sort) || !sort.length || !Array.isArray(data)) {
      return data;
    }

    const getByPath = (obj: any, path: string) =>
      !obj || !path ? undefined : path.split('.').reduce((acc, key) => acc?.[key], obj);

    return [...data].sort((a, b) => {
      for (const s of sort) {
        const selector = typeof s?.selector === 'string' ? s.selector : null;
        if (!selector) continue;

        const va = getByPath(a, selector);
        const vb = getByPath(b, selector);
        const na = Number(va);
        const nb = Number(vb);
        const bothNumeric =
          va !== null && va !== undefined && va !== '' &&
          vb !== null && vb !== undefined && vb !== '' &&
          Number.isFinite(na) && Number.isFinite(nb) &&
          typeof va !== 'boolean' && typeof vb !== 'boolean' &&
          !Array.isArray(va) && !Array.isArray(vb) &&
          typeof va !== 'object' && typeof vb !== 'object';

        let cmp = 0;
        if (bothNumeric) {
          cmp = na - nb;
        } else {
          const sa = (va ?? '').toString().toLowerCase();
          const sb = (vb ?? '').toString().toLowerCase();
          if (sa < sb) cmp = -1;
          else if (sa > sb) cmp = 1;
        }

        if (cmp !== 0) {
          return s.desc ? -cmp : cmp;
        }
      }
      return 0;
    });
  }

  onGridOptionChanged(e: any) {
    if (e.fullName !== 'searchPanel.text') return;

    const grid = this.dataGrid?.instance;
    const q = (e.value ?? '').toString().trim().toLowerCase();

    if (!q) {
      this.filtroActivo = '';
      grid?.option('dataSource', this.listaPermisos);
      return;
    }
    this.filtroActivo = q;

    let columnas: any[] = [];
    try {
      const colsOpt = grid?.option('columns');
      if (Array.isArray(colsOpt) && colsOpt.length) columnas = colsOpt;
    } catch { }
    if (!columnas.length && grid?.getVisibleColumns) {
      columnas = grid.getVisibleColumns();
    }

    const dataFields: string[] = columnas
      .map((c: any) => c?.dataField)
      .filter((df: any) => typeof df === 'string' && df.trim().length > 0);

    const getByPath = (obj: any, path: string) => {
      if (!obj || !path) return undefined;
      return path.split('.').reduce((acc, key) => acc?.[key], obj);
    };

    const normalizar = (val: any): string => {
      if (val === null || val === undefined) return '';
      if (val instanceof Date) {
        const dd = String(val.getDate()).padStart(2, '0');
        const mm = String(val.getMonth() + 1).padStart(2, '0');
        const yyyy = val.getFullYear();
        return `${dd}/${mm}/${yyyy}`.toLowerCase();
      }
      if (typeof val === 'string' && /\d{4}-\d{2}-\d{2}T?/.test(val)) {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const yyyy = d.getFullYear();
          return `${val.toLowerCase()} ${dd}/${mm}/${yyyy}`;
        }
      }
      if (Array.isArray(val)) return val.map(normalizar).join(' ');
      return String(val).toLowerCase();
    };
    const dataFiltrada = (this.paginaActualData || []).filter((row: any) => {
      const hitEnColumnas = dataFields.some((df) => normalizar(getByPath(row, df)).includes(q));
      const estNum = Number(row?.estatus);
      const estText = row?.estatusTexto ?? (estNum === 1 ? 'Activo' : estNum === 0 ? 'Inactivo' : '');
      const estHits =
        normalizar(estText).includes(q) ||
        normalizar(estNum).includes(q) ||
        (q === 'activo' && estNum === 1) ||
        (q === 'inactivo' && estNum === 0);

      const extras = [
        normalizar(row?.id),
        normalizar(row?.Id)
      ];
      const hitExtras = extras.some((s) => s.includes(q));

      return hitEnColumnas || estHits || hitExtras;
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

  agregarPermiso() {
    this.route.navigateByUrl('/administracion/permisos/agregar-permiso')
  }

  actualizarPermiso(idPermiso: number) {
    this.route.navigateByUrl('/administracion/permisos/editar-permiso/' + idPermiso);
  };

  async activar(rowData: any) {
    const res = await this.alerts.open({
      type: 'warning',
      title: '¡Activar!',
      message: `¿Está seguro que requiere activar el permiso: <strong>${rowData.nombre}</strong>?`,
      showCancel: true,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      backdropClose: false,
    });
    if (res !== 'confirm') return;

    this.permService.updateEstatus(rowData.id, 1).subscribe(
      () => {
        this.alerts.open({
          type: 'success',
          title: '¡Confirmación Realizada!',
          message: 'El permiso ha sido activado.',
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
      message: `¿Está seguro que requiere desactivar el permiso: <strong>${rowData.nombre}</strong>?`,
      showCancel: true,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      backdropClose: false,
    });
    if (res !== 'confirm') return;

    this.permService.updateEstatus(rowData.id, 0).subscribe(
      () => {
        this.alerts.open({
          type: 'success',
          title: '¡Confirmación Realizada!',
          message: 'El permiso ha sido desactivado.',
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
