import { mensajeDeError } from 'src/app/core/utils/mensaje-error';
import { Component, OnInit, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { ClientesService } from 'src/app/pages/services/clientes.service';
import { DispositivoBluevoxService } from 'src/app/pages/services/dispositivobluevox.service';
import { DispositivosService } from 'src/app/pages/services/dispositivos.service';
import { InstalacionesService } from 'src/app/pages/services/instalaciones.service';
import { VehiculosService } from 'src/app/pages/services/vehiculos.service';

@Component({
  selector: 'vex-lista-instalacion',
  templateUrl: './lista-instalacion.component.html',
  styleUrl: './lista-instalacion.component.scss',
  animations: [fadeInRight400ms],
})
export class ListaInstalacionComponent implements OnInit {
  layoutCtrl = new UntypedFormControl('fullwidth');

  public mensajeAgrupar: string = 'Arrastre un encabezado de columna aquí para agrupar por esa columna';
  public listaInstalaciones: any;
  public showFilterRow: boolean;
  public showHeaderFilter: boolean;
  public loading!: boolean;
  public loadingMessage: string = 'Cargando...';
  public showExportGrid!: boolean;
  public paginaActual: number = 1;
  public totalRegistros: number = 0;
  public pageSize: number = 20;
  public totalPaginas: number = 0;
  @ViewChild(DxDataGridComponent, { static: false }) dataGrid!: DxDataGridComponent;
  public autoExpandAllGroups: boolean = true;
  public paginaActualData: any[] = [];
  public filtroActivo: string = '';
  public listaDipositivos: any;
  public listaBlueVox: any;
  public listaVehiculos: any;
  public listaClientes: any;
  isGrouped: boolean = false;

  constructor(
    private router: Router,
    private insService: InstalacionesService,
    private dispoService: DispositivosService,
    private blueVoService: DispositivoBluevoxService,
    private vehiService: VehiculosService,
    private clieService: ClientesService,
    private alerts: AlertsService,
  ) {
    this.showFilterRow = true;
    this.showHeaderFilter = true;
  }

  ngOnInit() {
    this.setupDataSource();
    // this.obtenerListaModulos();
  }

  // hasPermission(permission: string): boolean {
  //   return this.permissionsService.getPermission(permission) !== undefined;
  // }

  agregarInstalacion() {
    this.router.navigateByUrl('/administracion/instalaciones/agregar-instalacion');
  }

  actualizarInstalacion(idInstalacion: number) {
    this.router.navigateByUrl('/administracion/instalaciones/editar-instalacion/' + idInstalacion);
  }

  async activar(rowData: any) {
    const res = await this.alerts.open({
      type: 'warning',
      title: '¡Activar!',
      message: '¿Está seguro que requiere activar está instalación?',
      showCancel: true,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      backdropClose: false,
    });

    if (res !== 'confirm') return;

    this.insService.updateEstatus(rowData.id, 1).subscribe(
      () => {
        this.alerts.open({
          type: 'success',
          title: '¡Confirmación Realizada!',
          message: 'La instalación ha sido activada.',
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
      message: '¿Está seguro que requiere desactivar está instalación?',
      showCancel: true,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      backdropClose: false,
    });

    if (res !== 'confirm') return;

    this.insService.updateEstatus(rowData.id, 0).subscribe(
      () => {
        this.alerts.open({
          type: 'success',
          title: '¡Confirmación Realizada!',
          message: 'La instalación ha sido desactivada.',
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
          message: mensajeDeError(error),
          confirmText: 'Confirmar',
          backdropClose: false,
        });
      }
    );
  }


  onPageIndexChanged(e: any) {
    const pageIndex = e.component.pageIndex();
    this.paginaActual = pageIndex + 1;
    e.component.refresh();
  }

  setupDataSource() {
    this.loading = true;
    this.listaInstalaciones = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const take = Number(loadOptions?.take) || this.pageSize || 10;
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;

        try {
          const resp: any = await lastValueFrom(
            this.insService.obtenerInstalacionesData(page, take)
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
          const dataTransformada = rows.map((item: any) => {
            // Extraer solo el número de serie del validador
            let numeroSerieValidador = null;
            if (item?.numeroSerieValidador) {
              numeroSerieValidador = item.numeroSerieValidador;
            } else if (item?.validadores && Array.isArray(item.validadores) && item.validadores.length > 0) {
              numeroSerieValidador = item.validadores[0]?.numeroSerie || item.validadores[0]?.numeroSerieValidador || null;
            } else if (item?.validador) {
              numeroSerieValidador = item.validador.numeroSerie || item.validador.numeroSerieValidador || null;
            }

            // Extraer solo el número de serie de los contadores (puede ser un array)
            let numeroSerieContador = null;
            if (item?.numeroSerieContador) {
              numeroSerieContador = item.numeroSerieContador;
            } else if (item?.numeroSerieContadores && Array.isArray(item.numeroSerieContadores)) {
              numeroSerieContador = item.numeroSerieContadores.map((c: any) => 
                c?.numeroSerie || c?.numeroSerieContador || c
              ).filter(Boolean).join(', ');
            } else if (item?.contadores && Array.isArray(item.contadores) && item.contadores.length > 0) {
              numeroSerieContador = item.contadores.map((c: any) => 
                c?.numeroSerie || c?.numeroSerieContador || c?.numeroSerieBlueVox || null
              ).filter(Boolean).join(', ');
            } else if (item?.contador) {
              numeroSerieContador = item.contador.numeroSerie || item.contador.numeroSerieContador || null;
            }

            return {
              ...item,
              numeroSerieValidador: numeroSerieValidador,
              numeroSerieContador: numeroSerieContador,
              estatusTexto:
                item?.estatus === 1 ? 'Activo' :
                  item?.estatus === 0 ? 'Inactivo' : null
            };
          });
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
    if (e.fullName === "searchPanel.text") {
      this.filtroActivo = e.value || '';
      if (!this.filtroActivo) {
        this.dataGrid.instance.option('dataSource', this.listaInstalaciones);
        return;
      }
      const search = this.filtroActivo.toString().toLowerCase();
      const dataFiltrada = this.paginaActualData.filter((item: any) => {
        const idStr = item.id ? item.id.toString().toLowerCase() : '';
        const nombreStr = item.nombre ? item.nombre.toString().toLowerCase() : '';
        const descripcionStr = item.descripcion ? item.descripcion.toString().toLowerCase() : '';
        const moduloStr = item.estatusTexto ? item.estatusTexto.toString().toLowerCase() : '';
        return (
          nombreStr.includes(search) ||
          descripcionStr.includes(search) ||
          moduloStr.includes(search) ||
          idStr.includes(search)
        );
      });
      this.dataGrid.instance.option('dataSource', dataFiltrada);
    }
  }

  obtenerDispositivos() {
    this.dispoService.obtenerDispositivos().subscribe((response) => {
      this.listaDipositivos = response;
    })
  }

  obtenerClientes() {
    this.clieService.obtenerClientes().subscribe((response) => {
      this.listaClientes = response;
    })
  }

  obtenerBluevox() {
    this.blueVoService.obtenerDispositivosBlue().subscribe((response) => {
      this.listaBlueVox = response;
    })
  }

  obtenerVehiculos() {
    this.vehiService.obtenerVehiculos().subscribe((response) => {
      this.listaVehiculos = response;
    })
  }

  agregarContadora() {
    this.router.navigateByUrl('/administracion/contadora/agregar-contadora')
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
}
