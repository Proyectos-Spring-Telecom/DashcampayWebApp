import { Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { VehiculosService } from 'src/app/pages/services/vehiculos.service';

@Component({
  selector: 'vex-lista-vehiculos',
  templateUrl: './lista-vehiculos.component.html',
  styleUrl: './lista-vehiculos.component.scss',
  animations: [fadeInRight400ms],
})
export class ListaVehiculosComponent implements OnInit {

  layoutCtrl = new UntypedFormControl('fullwidth');
  isLoading: boolean = false;
  listaVehiculos: any;
  public grid: boolean = false;
  public showFilterRow: boolean;
  public showHeaderFilter: boolean;
  public loadingVisible: boolean = false;
  public mensajeAgrupar: string = 'Arrastre un encabezado de columna aquí para agrupar por esa columna';
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

  constructor(private vehiService: VehiculosService,
    private alerts: AlertsService,
    private router: Router,         // para navegar
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer,) {
    this.showFilterRow = true;
    this.showHeaderFilter = true;
  }

  ngOnInit(): void {
    this.setupDataSource();
  }

  // hasPermission(permission: string): boolean {
  //   return this.permissionsService.getPermission(permission) !== undefined;
  // }

  setupDataSource() {
    this.loading = true;
    this.listaVehiculos = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const take = Number(loadOptions?.take) || this.pageSize || 10;
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;
        try {
          const resp: any = await lastValueFrom(
            this.vehiService.obtenerVehiculosData(page, take)
          );
          this.loading = false;
          const rows: any[] = Array.isArray(resp?.data) ? resp.data : [];
          const meta = resp?.paginated || {};
          const totalRegistros =
            toNum(meta.total) ??
            toNum(resp?.total) ??
            rows.length;

          const paginaActual =
            toNum(meta.page) ??
            toNum(resp?.page) ??
            page;

          const totalPaginas =
            toNum(meta.lastPage) ??
            toNum(resp?.pages) ??
            Math.max(1, Math.ceil(totalRegistros / take));
          const dataTransformada = rows.map((item: any) => ({
            ...item,
            estatusTexto:
              item?.estatus === 1 ? 'Activo' :
                item?.estatus === 0 ? 'Inactivo' : null
          }));
          this.totalRegistros = totalRegistros;
          this.paginaActual = paginaActual;
          this.totalPaginas = totalPaginas;
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
      grid?.option('dataSource', this.listaVehiculos);
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
        norm(row?.placa),
        norm(row?.numeroEconomico),
        norm(row?.ano)
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

  actualizarVehiculo(idVehiculo: number) {
    this.router.navigateByUrl('/administracion/vehiculos/editar-vehiculo/' + idVehiculo);
  };

  private getErrorMessage(err: any, fallback: string): string {
    const body = err?.error ?? err;

    const flatten = (value: any): string => {
      if (value == null || value === '') return '';
      if (typeof value === 'string') return value.trim();
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (Array.isArray(value)) {
        return value.map(flatten).filter(Boolean).join('\n');
      }
      if (typeof value === 'object') {
        if (typeof value.message === 'string' && value.message.trim()) return value.message.trim();
        if (typeof value.mensaje === 'string' && value.mensaje.trim()) return value.mensaje.trim();
        if (Array.isArray(value.message)) return flatten(value.message);
        if (Array.isArray(value.mensaje)) return flatten(value.mensaje);
        if (value.errors) return flatten(value.errors);
        const lines: string[] = [];
        for (const key of Object.keys(value)) {
          if (key === 'statusCode' || key === 'error' || key === 'status') continue;
          const part = flatten(value[key]);
          if (part) lines.push(part);
        }
        return lines.join('\n');
      }
      return '';
    };

    const fromBody = flatten(body);
    if (fromBody) return fromBody;

    if (typeof err?.message === 'string' && err.message.trim() && !err.message.startsWith('Http failure')) {
      return err.message.trim();
    }

    return fallback;
  }

  async activar(rowData: any) {
    const res = await this.alerts.open({
      type: 'warning',
      title: '¡Activar!',
      message: `¿Está seguro que requiere activar el vehículo: <br> <strong>${rowData.marca} ${rowData.modelo}</strong>?`,
      showCancel: true,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      backdropClose: false,
    });

    if (res !== 'confirm') return;

    this.vehiService.updateEstatus(rowData.id, 1).subscribe(
      () => {
        this.alerts.open({
          type: 'success',
          title: '¡Confirmación Realizada!',
          message: 'El vehículo ha sido activado.',
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
          message: this.getErrorMessage(error, 'Ocurrió un error al activar el vehículo.'),
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
      message: `¿Está seguro que requiere desactivar el vehículo: <br> <strong>${rowData.marca} ${rowData.modelo}</strong>?`,
      showCancel: true,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      backdropClose: false,
    });

    if (res !== 'confirm') return;

    this.vehiService.updateEstatus(rowData.id, 0).subscribe(
      () => {
        this.alerts.open({
          type: 'success',
          title: '¡Confirmación Realizada!',
          message: 'El vehículo ha sido desactivado.',
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
          message: this.getErrorMessage(error, 'Ocurrió un error al desactivar el vehículo.'),
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

  irAVerDocumento(url: string, titulo: string, fila: any) {
    this.router.navigate(['ver-documento'], {
      relativeTo: this.route,
      queryParams: { url, titulo }
    });
  }

  agregarVehiculo() {
    this.router.navigateByUrl('/administracion/vehiculos/agregar-vehiculo')
  }

}
