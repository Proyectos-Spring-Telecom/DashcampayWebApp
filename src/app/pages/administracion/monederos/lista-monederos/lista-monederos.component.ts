import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  ViewChild
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  UntypedFormControl,
  Validators
} from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { DxDataGridComponent } from 'devextreme-angular';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { MonederosServices } from 'src/app/pages/services/monederos.service';
import { TransaccionesService } from 'src/app/pages/services/transacciones.service';
import { AuthenticationService } from 'src/app/core/services/auth.service';
import { Router } from '@angular/router';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { CambiarEstadoMonederoModalComponent, CambiarEstadoMonederoData } from '../cambiar-estado-monedero-modal/cambiar-estado-monedero-modal.component';

@Component({
  selector: 'vex-lista-monederos',
  templateUrl: './lista-monederos.component.html',
  styleUrl: './lista-monederos.component.scss',
  animations: [fadeInRight400ms]
})
export class ListaMonederosComponent implements OnInit {
  layoutCtrl = new UntypedFormControl('fullwidth');
  isLoading: boolean = false;
  listaMonederos: any;
  public grid: boolean = false;
  public showFilterRow: boolean;
  public showHeaderFilter: boolean;
  public loadingVisible: boolean = false;
  public mensajeAgrupar: string =
    'Arrastre un encabezado de columna aquí para agrupar por esa columna';
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  public autoExpandAllGroups: boolean = true;
  @ViewChild(DxDataGridComponent, { static: false })
  dataGrid!: DxDataGridComponent;
  isGrouped: boolean = false;
  modalClosing = false;
  modalErrorOpen = false;
  modalErrorClosing = false;
  public recargaForm!: FormGroup;
  public debitoForm!: FormGroup;
  modalOpen = false;
  modalAnim: 'in' | 'out' | '' = '';
  tipoOperacion: 'recarga' | 'debito' = 'recarga';
  selectedTransaccion: {
    id: any;
    saldo: number | string;
    numSerie: string;
  } | null = null;
  montoIngresado: number | null = null;
  submitButton = 'Confirmar';
  loading = false;
  readonly MAX_RECARGA = 5000;
  public paginaActual: number = 1;
  public totalRegistros: number = 0;
  public pageSize: number = 20;
  public totalPaginas: number = 0;
  public paginaActualData: any[] = [];
  public filtroActivo: string = '';

  constructor(
    private dialog: MatDialog,
    private moneService: MonederosServices,
    private transaccionService: TransaccionesService,
    private auth: AuthenticationService,
    private alerts: AlertsService,
    private fb: FormBuilder,
    private route: Router
  ) {
    this.showFilterRow = true;
    this.showHeaderFilter = true;
  }

  ngOnInit(): void {
    this.initForm();
    this.obtenerMonederos();
  }

  obtenerMonederos() {
    this.loading = true;
    this.listaMonederos = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const take = Number(loadOptions?.take) || this.pageSize || 10;
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;
        try {
          const resp: any = await lastValueFrom(
            this.moneService.obtenerMonederosData(page, take)
          );
          this.loading = false;
          const rows: any[] = Array.isArray(resp?.data) ? resp.data : [];
          const meta = resp?.paginated || {};
          const totalRegistros =
            toNum(meta.total) ?? toNum(resp?.total) ?? rows.length;

          const paginaActual = toNum(meta.page) ?? toNum(resp?.page) ?? page;
          const totalPaginas =
            toNum(meta.lastPage) ??
            toNum(resp?.pages) ??
            Math.max(1, Math.ceil(totalRegistros / take));
          const dataTransformada = rows.map((item: any) => ({
            ...item,
            estatusTexto:
              item?.estatus === 1
                ? 'Activo'
                : item?.estatus === 0
                  ? 'Inactivo'
                  : null
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
    const texto = (e.value ?? '').toString().trim().toLowerCase();
    if (!texto) {
      grid?.option('dataSource', this.listaMonederos);
      this.filtroActivo = '';
      return;
    }
    this.filtroActivo = texto;
    let columnas: any[] = [];
    try {
      const colsOpt = grid?.option('columns');
      if (Array.isArray(colsOpt) && colsOpt.length) columnas = colsOpt;
    } catch {}
    if (!columnas.length && grid?.getVisibleColumns) {
      columnas = grid.getVisibleColumns();
    }
    const dataFields: string[] = columnas
      .map((c: any) => c?.dataField)
      .filter((df: any) => typeof df === 'string' && df.trim().length > 0);
    const normalizar = (val: any): string => {
      if (val === null || val === undefined) return '';
      if (val instanceof Date) {
        const dd = ('0' + val.getDate()).slice(2 - 2);
        const mm = ('0' + (val.getMonth() + 1)).slice(2 - 2);
        const yyyy = val.getFullYear();
        return `${dd}/${mm}/${yyyy}`.toLowerCase();
      }
      if (typeof val === 'number') return String(val).toLowerCase();
      const s = String(val).toLowerCase();
      return s;
    };
    const dataFiltrada = (this.paginaActualData || []).filter((row: any) => {
      const hitEnColumnas = dataFields.some((df) => {
        const v = row?.[df];
        if (df.toLowerCase().includes('fecha')) {
          try {
            const d = new Date(v);
            if (!isNaN(d.getTime())) {
              const dd = ('0' + d.getDate()).slice(-2);
              const mm = ('0' + (d.getMonth() + 1)).slice(-2);
              const yyyy = d.getFullYear();
              const ddmmyyyy = `${dd}/${mm}/${yyyy}`.toLowerCase();
              if (ddmmyyyy.includes(texto)) return true;
            }
          } catch {}
        }
        return normalizar(v).includes(texto);
      });
      const extras = [normalizar(row?.id), normalizar(row?.estatusTexto)];

      return hitEnColumnas || extras.some((s) => s.includes(texto));
    });
    grid?.option('dataSource', dataFiltrada);
  }

  onPageIndexChanged(e: any) {
    const pageIndex = e.component.pageIndex();
    this.paginaActual = pageIndex + 1;
    e.component.refresh();
  }

  agregarMonedero() {
    this.route.navigateByUrl('/administracion/monederos/agregar-monedero');
  }

  limpiarCampos() {
    const today = new Date();
    this.dataGrid.instance.clearGrouping();
    this.isGrouped = false;
    this.obtenerMonederos();
    this.dataGrid.instance.refresh();
  }

  editarMonedero(idMonedero: number) {
    this.route.navigateByUrl(`/administracion/monederos/editar-monedero/${idMonedero}`);
  }

  cambiarEstado(rowData: any) {
    const data: CambiarEstadoMonederoData = {
      numeroSerie: rowData.numeroSerie || 'N/A',
      idMonedero: rowData.id || 0
    };
    const dialogRef = this.dialog.open(CambiarEstadoMonederoModalComponent, {
      width: '450px',
      disableClose: true,
      data: data
    });
    dialogRef.afterClosed().subscribe((idTipoPasajero: number | undefined) => {
      if (idTipoPasajero !== undefined && idTipoPasajero !== null) {
        this.moneService.actualizarTipoPasajero(rowData.id, idTipoPasajero).subscribe({
          next: () => {
            this.alerts.open({
              type: 'success',
              title: '¡Operación Exitosa!',
              message: 'El tipo de pasajero del monedero se actualizó correctamente.',
              confirmText: 'Confirmar',
              backdropClose: false,
            });
            this.obtenerMonederos();
            this.dataGrid.instance.refresh();
          },
          error: (error) => {
            this.alerts.open({
              type: 'error',
              title: '¡Ops!',
              message: 'Ocurrió un error al actualizar el tipo de pasajero del monedero.',
              confirmText: 'Confirmar',
              backdropClose: false,
            });
          }
        });
      }
    });
  }

  toggleExpandGroups() {
    const groupedColumns = this.dataGrid.instance
      .getVisibleColumns()
      .filter((col) => (col.groupIndex ?? -1) >= 0);
    if (groupedColumns.length === 0) {
      this.alerts.open({
        type: 'info',
        title: '¡Ops!',
        message:
          'Debes arrastar un encabezado de una columna para expandir o contraer grupos.',
        backdropClose: false
      });
    } else {
      this.autoExpandAllGroups = !this.autoExpandAllGroups;
      this.dataGrid.instance.refresh();
    }
  }

  onBackdropError() {
    this.closeErrorModal();
  }
  closeErrorModal() {
    this.modalErrorClosing = true;
    setTimeout(() => {
      this.modalErrorOpen = false;
      this.modalErrorClosing = false;
    }, 200);
  }

  onBackdrop() {
    this.closeModal();
  }
  closeModal() {
    this.modalClosing = true;
    setTimeout(() => {
      this.modalOpen = false;
      this.modalClosing = false;
    }, 600);
  }

  initForm() {
    this.recargaForm = this.fb.group({
      tipoTransaccion: ['Recarga'],
      monto: [null, [Validators.required, Validators.min(0.01), Validators.max(this.MAX_RECARGA)]],
      latitud: [null],
      longitud: [null],
      fechaHora: [null],
      numeroSerieMonedero: [null],
      numeroSerieValidador: [null]
    });

    this.debitoForm = this.fb.group({
      tipoTransaccion: ['Recarga'],
      monto: [null, [Validators.required]],
      latitud: [null],
      longitud: [null],
      fechaHora: [null],
      numeroSerieMonedero: [null],
      numeroSerieValidador: [null]
    });
  }

  abrirModal(tipo: 'recarga' | 'debito', raw: any) {
    this.tipoOperacion = tipo;

    const id = raw?.Id ?? raw?.id ?? null;
    const saldo = raw?.Saldo ?? raw?.saldo ?? 0;
    const numeroSerie =
      raw?.numeroSerie ?? raw?.NumeroSerie ?? raw?.numSerie ?? null;

    this.selectedTransaccion = { id, saldo, numSerie: numeroSerie };

    const form = tipo === 'recarga' ? this.recargaForm : this.debitoForm;
    form.reset({
      tipoTransaccion: tipo === 'recarga' ? 'RECARGA' : 'DEBITO',
      monto: null,
      latitud: null,
      longitud: null,
      fechaHora: this.nowWithOffset(),
      numeroSerieMonedero: numeroSerie,
      numeroSerieValidador: null
    });

    this.modalOpen = true;
    this.modalAnim = 'in';
    this.modalClosing = false;
  }

  cerrarModal() {
    this.modalClosing = true;
    this.modalAnim = 'out';
    setTimeout(() => {
      this.modalOpen = false;
      this.modalClosing = false;
      this.modalAnim = '';
      this.montoIngresado = null;
    }, 300);
  }

  onAnimationEnd() {
    if (this.modalAnim === 'out') {
      this.modalOpen = false;
    }
  }

  onMontoInput(event: Event) {
    if (this.tipoOperacion !== 'recarga') return;
    const input = event.target as HTMLInputElement;
    const n = Number(input.value);
    if (!Number.isFinite(n)) return;
    if (n > this.MAX_RECARGA) {
      input.value = String(this.MAX_RECARGA);
      this.recargaForm.get('monto')?.setValue(this.MAX_RECARGA);
      this.recargaForm.get('monto')?.markAsTouched();
    }
  }

  private rolActual(): number {
    const user = this.auth.getUser() || {};
    return Number(user?.idRol ?? user?.rol?.id ?? user?.rol ?? 0);
  }

  confirmarOperacion() {
    if (this.tipoOperacion === 'recarga' && this.rolActual() === 9) {
      this.alerts.open({
        type: 'warning',
        title: 'Sin permiso',
        message: 'Tu rol no puede recargar en efectivo.',
        confirmText: 'Entendido'
      });
      return;
    }
    const form =
      this.tipoOperacion === 'recarga' ? this.recargaForm : this.debitoForm;
    const opNombre = this.tipoOperacion === 'recarga' ? 'Recarga' : 'Débito';
    const opVerbo = this.tipoOperacion === 'recarga' ? 'recargar' : 'debitar';

    const montoVal = Number(form.get('monto')?.value);
    if (!montoVal || isNaN(montoVal) || montoVal <= 0) {
      setTimeout(() => {
        this.alerts.open({
          type: 'warning',
          title: 'Monto inválido',
          message: `Ingresa un monto mayor a 0 para ${opVerbo}.`,
          confirmText: 'Aceptar'
        });
      }, 200);
      return;
    }

    if (this.tipoOperacion === 'recarga' && montoVal > this.MAX_RECARGA) {
      form.get('monto')?.setValue(this.MAX_RECARGA);
      setTimeout(() => {
        this.alerts.open({
          type: 'warning',
          title: 'Monto excedido',
          message: `El monto máximo de recarga es ${this.MAX_RECARGA.toLocaleString('es-MX')}.`,
          confirmText: 'Aceptar'
        });
      }, 200);
      return;
    }

    const numeroSerie =
      this.selectedTransaccion?.numSerie ??
      form.get('numeroSerieMonedero')?.value ??
      null;

    this.loading = true;
    this.submitButton = 'Cargando...';

    const request$ =
      this.tipoOperacion === 'recarga'
        ? this.transaccionService.agregarRecarga({
            idTipoTransaccion: 1,
            monto: montoVal,
            latitudInicial: null,
            longitudInicial: null,
            numeroSerieMonedero: numeroSerie,
            numeroSerieValidador: null,
            idMetodoPago: 1
          })
        : this.moneService.crearTransaccion({
            tipoTransaccion: form.get('tipoTransaccion')?.value,
            monto: montoVal,
            latitud: null,
            longitud: null,
            fechaHora: form.get('fechaHora')?.value || this.nowWithOffset(),
            numeroSerieMonedero: numeroSerie,
            numeroSerieValidador: null
          });

    request$.subscribe({
      next: () => {
        this.loading = false;
        this.submitButton = 'Confirmar';
        this.ngOnInit();
        this.cerrarModal();
        setTimeout(() => {
          this.alerts.open({
            type: 'success',
            title: '¡Operación Exitosa!',
            message: `La transacción ${opNombre} se realizó de manera correcta.`,
            confirmText: 'Confirmar'
          });
        }, 200);
      },
      error: (err: any) => {
        this.loading = false;
        this.submitButton = 'Confirmar';
        this.getErrorMessage(err).then((msg) => {
          setTimeout(() => {
            this.alerts.open({
              type: 'error',
              title: '¡Ops!',
              message: msg,
              confirmText: 'Aceptar',
              backdropClose: false
            });
          }, 200);
        });
      }
    });
  }

  private nowWithOffset(): string {
    const d = new Date();
    const tz = d.getTimezoneOffset();
    const sign = tz > 0 ? '-' : '+';
    const local = new Date(d.getTime() - tz * 60000);
    const iso = local.toISOString().slice(0, 19);
    const hh = String(Math.floor(Math.abs(tz) / 60)).padStart(2, '0');
    const mm = String(Math.abs(tz) % 60).padStart(2, '0');
    return `${iso}${sign}${hh}:${mm}`;
  }

  private async getErrorMessage(err: any): Promise<string> {
    if (err?.status === 0 && !err?.error) {
      return 'No hay conexión con el servidor (status 0). Verifica tu red.';
    }
    if (err?.error instanceof Blob) {
      try {
        const txt = await err.error.text();
        if (txt) return txt;
      } catch {
      }
    }
    if (typeof err?.error === 'string' && err.error.trim()) {
      return err.error;
    }
    if (typeof err?.message === 'string' && err.message.trim()) {
      return err.message;
    }
    if (err?.error?.message) {
      return String(err.error.message);
    }
    if (err?.error?.errors) {
      const e = err.error.errors;
      if (Array.isArray(e)) {
        return e.filter(Boolean).join('\n');
      }
      if (typeof e === 'object') {
        const lines: string[] = [];
        for (const k of Object.keys(e)) {
          const val = e[k];
          if (Array.isArray(val)) lines.push(`${k}: ${val.join(', ')}`);
          else if (val) lines.push(`${k}: ${val}`);
        }
        if (lines.length) return lines.join('\n');
      }
    }
    const statusLine = err?.status
      ? `HTTP ${err.status}${err.statusText ? ' ' + err.statusText : ''}`
      : '';
    return statusLine;
  }
}
