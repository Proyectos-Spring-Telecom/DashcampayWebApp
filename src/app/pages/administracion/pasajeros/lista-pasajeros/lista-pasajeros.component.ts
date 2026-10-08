import { mensajeDeError } from 'src/app/core/utils/mensaje-error';
import { Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { PasajerosService } from 'src/app/pages/services/pasajeros.service';
import { MatDialog } from '@angular/material/dialog';
import { VerLicenciaModalComponent, VerLicenciaData } from '../../operadores/ver-licencia-modal/ver-licencia-modal.component';

@Component({
  selector: 'vex-lista-pasajeros',
  templateUrl: './lista-pasajeros.component.html',
  styleUrl: './lista-pasajeros.component.scss',
  animations: [fadeInRight400ms],
})
export class ListaPasajerosComponent implements OnInit {


  layoutCtrl = new UntypedFormControl('fullwidth');
  listaPasajeros: any;
  public showFilterRow: boolean;
  public showHeaderFilter: boolean;
  public loadingVisible: boolean = false;
  public mensajeAgrupar: string = "Arrastre un encabezado de columna aquí para agrupar por esa columna"
  public loading: boolean = false;
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

  constructor(private pasaService: PasajerosService,
    private route: Router,
    private activatedRoute: ActivatedRoute,
    private alerts: AlertsService,
    private dialog: MatDialog,
  ) {
    this.showFilterRow = true;
    this.showHeaderFilter = true;
  }

  ngOnInit(): void {
    this.obtenerListaPasajeros();
  }

  // hasPermission(permission: string): boolean {
  //   return this.permissionsService.getPermission(permission) !== undefined;
  // }

  obtenerListaPasajeros() {
    this.loading = true;
    this.listaPasajeros = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const skip = Number(loadOptions?.skip) || 0;
        const take = Number(loadOptions?.take) || this.pageSize;
        const page = Math.floor(skip / take) + 1;
        try {
          const response: any = await lastValueFrom(
            this.pasaService.obtenerPasajerosData(page, take)
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
              const estadoSolicitud = Number(item?.estadoSolicitud ?? item?.EstadoSolicitud ?? 0);
              const estadoSolicitudTexto = estadoSolicitud === 0 ? 'No Solicitado' : estadoSolicitud === 1 ? 'Solicitado' : '—';
              return {
                ...item,
                nombreCompleto: item.nombre + ' ' + item.apellidoPaterno + ' ' + item.apellidoMaterno,
                id: Number.isFinite(idNum) ? idNum : 0,
                curp: item?.curp ?? item?.Curp ?? '',
                numeroSerie: item?.numeroSerie ?? item?.NumeroSerie ?? item?.numeroSerieMonedero ?? item?.NumeroSerieMonedero ?? '',
                documentacion: item?.documentacion ?? item?.Documentacion ?? null,
                estadoSolicitud: estadoSolicitud,
                estadoSolicitudTexto: estadoSolicitudTexto,
                nombreCatPasajero: item?.nombreCatPasajero ?? item?.NombreCatPasajero ?? item?.tipoPasajero?.nombreCatPasajero ?? item?.TipoPasajero?.NombreCatPasajero ?? item?.tipoPasajero?.nombre ?? item?.TipoPasajero?.Nombre ?? '—',
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

  onPageIndexChanged(e: any) {
    const pageIndex = e.component.pageIndex();
    this.paginaActual = pageIndex + 1;
    e.component.refresh();
  }

  onGridOptionChanged(e: any) {
    if (e.fullName === "searchPanel.text") {
      this.filtroActivo = e.value || '';
      if (!this.filtroActivo) {
        this.dataGrid.instance.option('dataSource', this.listaPasajeros);
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

  agregarPasajero() {
    this.route.navigateByUrl('/administracion/pasajeros/agregar-pasajero')
  }

  actualizarPasajero(idPasajero: number) {
    this.route.navigateByUrl('/administracion/pasajeros/editar-pasajero/' + idPasajero);
  };

  async activar(rowData: any) {
    const res = await this.alerts.open({
      type: 'warning',
      title: '¡Activar!',
      message: `¿Está seguro que requiere activar al pasajero(a): <br> <strong>${rowData.nombreCompleto}</strong>?`,
      showCancel: true,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      backdropClose: false,
    });

    if (res !== 'confirm') return;

    this.pasaService.updateEstatus(rowData.id, 1).subscribe(
      () => {
        this.alerts.open({
          type: 'success',
          title: '¡Confirmación Realizada!',
          message: 'El pasajero ha sido activado.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });
        this.obtenerListaPasajeros();
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
      message: `¿Está seguro que requiere desactivar al pasajero(a): <br> <strong>${rowData.nombreCompleto}</strong>?`,
      showCancel: true,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      backdropClose: false,
    });

    if (res !== 'confirm') return;

    this.pasaService.updateEstatus(rowData.id, 0).subscribe(
      () => {
        this.alerts.open({
          type: 'success',
          title: '¡Confirmación Realizada!',
          message: 'El pasajero ha sido desactivado.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });
        this.obtenerListaPasajeros();
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

  limpiarCampos() {
    const today = new Date();
    this.dataGrid.instance.clearGrouping();
    this.isGrouped = false;
    this.obtenerListaPasajeros();
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
    if (!url) {
      this.alerts.open({
        type: 'info',
        title: 'Información',
        message: 'No hay documentación disponible para este pasajero.',
        confirmText: 'Entendido'
      });
      return;
    }

    const data: VerLicenciaData = {
      url: url,
      titulo: titulo || 'Documentación Oficial'
    };

    this.dialog.open(VerLicenciaModalComponent, {
      width: '80vw',
      maxWidth: '1200px',
      height: '80vh',
      maxHeight: '800px',
      disableClose: false,
      data: data,
      panelClass: 'ver-licencia-dialog'
    });
  }
}
