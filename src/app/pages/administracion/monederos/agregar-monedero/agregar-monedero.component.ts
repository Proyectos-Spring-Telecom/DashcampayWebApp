import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, UntypedFormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { ClientesService } from 'src/app/pages/services/clientes.service';
import { DispositivosService } from 'src/app/pages/services/dispositivos.service';
import { MonederosServices } from 'src/app/pages/services/monederos.service';
import { PasajerosService } from 'src/app/pages/services/pasajeros.service';
import { TiposPasajeroService } from 'src/app/pages/services/tipos-pasajero.service';

@Component({
  selector: 'vex-agregar-monedero',
  templateUrl: './agregar-monedero.component.html',
  styleUrl: './agregar-monedero.component.scss',
  animations: [fadeInRight400ms],
})
export class AgregarMonederoComponent implements OnInit {
  layoutCtrl = new UntypedFormControl('fullwidth');
  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public monederoForm!: FormGroup;
  public idMonedero: number | null = null;
  public title = 'Agregar Monedero';
  public listaClientes: any[] = [];
  public listaPasajeros: any[] = [];
  public listaTiposPasajero: any[] = [];
  public showDatosID = true;
  selectedFileName: string = '';
  previewUrl: string | ArrayBuffer | null = null;

  private clientesCargados = false;
  private pasajerosCargados = false;
  private tiposCargados = false;
  private datosMonedero: any = null;

  constructor(
    private route: Router,
    private fb: FormBuilder,
    private dispoService: DispositivosService,
    private activatedRouted: ActivatedRoute,
    private clieService: ClientesService,
    private moneService: MonederosServices,
    private pasaService: PasajerosService,
    private tiposPasajeroService: TiposPasajeroService,
    private alerts: AlertsService,
  ) { }

  ngOnInit(): void {
    this.initForm();
    this.obtenerClientes();
    this.obtenerPasajeros();
    this.obtenerTiposPasajero();

    this.activatedRouted.params.subscribe((params) => {
      this.idMonedero = params['idMonedero'] ? Number(params['idMonedero']) : null;
      if (this.idMonedero) {
        this.title = 'Actualizar Monedero';
        this.submitButton = 'Actualizar';
        this.showDatosID = false;

        const saldoCtrl = this.monederoForm.get('saldo');
        saldoCtrl?.clearValidators();
        saldoCtrl?.updateValueAndValidity();
        this.obtenerMonedero();
      }
    });

    this.monederoForm.get('idPasajero')?.valueChanges.subscribe((idPasajero) => {
      this.sincronizarTipoPasajero(idPasajero);
    });
  }

  private sincronizarTipoPasajero(idPasajero: unknown): void {
    if (idPasajero == null || idPasajero === '') {
      this.monederoForm.get('idTipoPasajero')?.setValue(null, { emitEvent: false });
      return;
    }
    const pasajeroSeleccionado = this.listaPasajeros.find(
      (p: any) => Number(p.id) === Number(idPasajero)
    );
    const idTipo =
      pasajeroSeleccionado?.idTipoPasajero ??
      pasajeroSeleccionado?.tipoPasajero?.id ??
      null;
    this.monederoForm.get('idTipoPasajero')?.setValue(
      idTipo != null ? Number(idTipo) : null,
      { emitEvent: false }
    );
  }

  private intentarLlenarFormulario(): void {
    if (this.datosMonedero && this.clientesCargados && this.pasajerosCargados && this.tiposCargados) {
      const data = this.datosMonedero;
      this.datosMonedero = null;
      this.llenarFormulario(data);
    }
  }

  obtenerPasajeros() {
    this.pasaService.obtenerPasajeros().subscribe((response) => {
      this.listaPasajeros = (response?.data || response || []).map((c: any) => ({
        ...c,
        id: Number(c?.id ?? c?.Id ?? c?.ID),
        idTipoPasajero: c?.idTipoPasajero != null
          ? Number(c.idTipoPasajero)
          : (c?.tipoPasajero?.id != null ? Number(c.tipoPasajero.id) : null),
      }));
      this.pasajerosCargados = true;
      this.intentarLlenarFormulario();
    });
  }

  obtenerClientes() {
    this.clieService.obtenerClientes().subscribe((response) => {
      this.listaClientes = (response?.data || response || []).map((c: any) => ({
        ...c,
        id: Number(c?.id ?? c?.Id ?? c?.ID),
      }));
      this.clientesCargados = true;
      this.intentarLlenarFormulario();
    });
  }

  obtenerMonedero() {
    if (!this.idMonedero) return;

    this.moneService.obtenerMonedero(this.idMonedero).subscribe({
      next: (response: any) => {
        const raw = response?.data ?? response;
        const data = Array.isArray(raw)
          ? (raw.find((x: any) => Number(x?.id) === Number(this.idMonedero)) ?? raw[0])
          : raw;

        if (!data) {
          this.alerts.open({
            type: 'warning',
            title: '¡Ops!',
            message: 'No se encontraron datos del monedero.',
            confirmText: 'Confirmar',
            backdropClose: false,
          });
          return;
        }

        if (this.clientesCargados && this.pasajerosCargados && this.tiposCargados) {
          this.llenarFormulario(data);
        } else {
          this.datosMonedero = data;
        }
      },
      error: () => {
        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: 'Ocurrió un error al cargar los datos del monedero.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });
        this.regresar();
      }
    });
  }

  private llenarFormulario(data: any): void {
    if (Array.isArray(data) && data.length > 0) {
      data = data.find((x: any) => Number(x?.id) === Number(this.idMonedero)) ?? data[0];
    }

    const numeroSerie = data?.numeroSerie ?? data?.NumeroSerie ?? '';
    const idPasajero =
      data?.idPasajero ??
      data?.IdPasajero ??
      data?.pasajero?.id ??
      data?.Pasajero?.id ??
      null;
    const idCliente =
      data?.idCliente ??
      data?.IdCliente ??
      data?.cliente?.id ??
      data?.Cliente?.id ??
      null;
    const idTipoPasajero =
      data?.idTipoPasajero ??
      data?.IdTipoPasajero ??
      data?.tipoPasajero?.id ??
      data?.TipoPasajero?.id ??
      data?.pasajero?.idTipoPasajero ??
      null;

    this.monederoForm.patchValue({
      numeroSerie: numeroSerie ?? '',
      idPasajero: idPasajero != null ? Number(idPasajero) : null,
      idCliente: idCliente != null ? Number(idCliente) : null,
    }, { emitEvent: false });

    let tipoFinal: number | null = idTipoPasajero != null ? Number(idTipoPasajero) : null;
    if (tipoFinal == null && idPasajero != null) {
      const p = this.listaPasajeros.find((x: any) => Number(x.id) === Number(idPasajero));
      tipoFinal = p?.idTipoPasajero != null ? Number(p.idTipoPasajero) : null;
    }

    this.monederoForm.get('idTipoPasajero')?.setValue(tipoFinal, { emitEvent: false });
    this.monederoForm.updateValueAndValidity({ emitEvent: false });
  }

  obtenerTiposPasajero() {
    this.tiposPasajeroService.obtenerTiposPasajeroList().subscribe({
      next: (response: any) => {
        let raw: any[] = [];
        if (Array.isArray(response)) {
          raw = response;
        } else if (Array.isArray(response?.data)) {
          raw = response.data;
        } else if (Array.isArray(response?.data?.data)) {
          raw = response.data.data;
        }
        this.listaTiposPasajero = raw.map((tipo: any) => ({
          ...tipo,
          id: Number(tipo?.id ?? tipo?.idTipoPasajero ?? tipo?.Id ?? tipo?.ID),
        }));
        this.tiposCargados = true;
        this.intentarLlenarFormulario();
      },
      error: () => {
        this.listaTiposPasajero = [];
        this.tiposCargados = true;
        this.intentarLlenarFormulario();
      }
    });
  }

  initForm() {
    this.monederoForm = this.fb.group({
      numeroSerie: ['', Validators.required],
      saldo: [{ value: 0, disabled: true }],
      estatus: [1, Validators.required],
      idPasajero: [null],
      idCliente: [null, Validators.required],
      idTipoPasajero: [{ value: null, disabled: true }],
    });
  }

  submit() {
    this.submitButton = 'Cargando...';
    this.loading = true;
    if (this.idMonedero) {
      this.actualizar();
    } else {
      this.agregar();
    }
  }

  async agregar() {
    this.submitButton = 'Cargando...';
    this.loading = true;

    if (this.monederoForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;

      const etiquetas: any = {
        numeroSerie: 'Número de Serie',
        estatus: 'Estatus',
        idCliente: 'Cliente',
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.monederoForm.controls).forEach((key) => {
        const control = this.monederoForm.get(key);
        if (control?.invalid && control.errors?.['required']) {
          camposFaltantes.push(etiquetas[key] || key);
        }
      });

      const lista = camposFaltantes.map((campo, index) => `
      <div style="padding: 8px 12px; border-left: 4px solid #d9534f;
                  background: #caa8a8; text-align: center; margin-bottom: 8px;
                  border-radius: 4px;">
        <strong style="color: #b02a37;">${index + 1}. ${campo}</strong>
      </div>
    `).join('');

      await this.alerts.open({
        type: 'warning',
        title: '¡Faltan campos obligatorios!',
        message: `
        <p style="text-align: center; font-size: 15px; margin-bottom: 16px; color: white">
          Los siguientes <strong>campos obligatorios</strong> están vacíos.<br>
          Por favor complétalos antes de continuar:
        </p>
        <div style="max-height: 350px; overflow-y: auto;">${lista}</div>
      `,
        confirmText: 'Entendido',
        backdropClose: false,
      });
      return;
    }

    const raw = this.monederoForm.getRawValue();
    const payload: any = { ...raw };
    delete payload.saldo;

    this.monederoForm.removeControl('id');

    this.moneService.agregarMonedero(payload).subscribe(
      () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'Se agregó un nuevo monedero de manera exitosa.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });
        this.regresar();
      },
      () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: 'Ocurrió un error al agregar el monedero.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });
      }
    );
  }

  async actualizar() {
    this.submitButton = 'Cargando...';
    this.loading = true;

    if (this.monederoForm.invalid) {
      this.submitButton = 'Actualizar';
      this.loading = false;

      const etiquetas: any = {
        numeroSerie: 'Número de Serie',
        idCliente: 'Cliente',
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.monederoForm.controls).forEach((key) => {
        const control = this.monederoForm.get(key);
        if (control?.invalid && control.errors?.['required']) {
          camposFaltantes.push(etiquetas[key] || key);
        }
      });

      const lista = camposFaltantes.map((campo, index) => `
      <div style="padding: 8px 12px; border-left: 4px solid #d9534f;
                  background: #caa8a8; text-align: center; margin-bottom: 8px;
                  border-radius: 4px;">
        <strong style="color: #b02a37;">${index + 1}. ${campo}</strong>
      </div>
    `).join('');

      await this.alerts.open({
        type: 'warning',
        title: '¡Faltan campos obligatorios!',
        message: `
        <p style="text-align: center; font-size: 15px; margin-bottom: 16px; color: white">
          Los siguientes <strong>campos obligatorios</strong> están vacíos.<br>
          Por favor complétalos antes de continuar:
        </p>
        <div style="max-height: 350px; overflow-y: auto;">${lista}</div>
      `,
        confirmText: 'Entendido',
        backdropClose: false,
      });
      return;
    }

    const raw = this.monederoForm.getRawValue();
    const payload: any = {
      numeroSerie: raw.numeroSerie,
      estatus: Number(raw.estatus || 1),
    };
    if (raw.idPasajero != null && raw.idPasajero !== '') {
      payload.idPasajero = Number(raw.idPasajero);
    }

    this.moneService.actualizarMonedero(this.idMonedero!, payload).subscribe(
      () => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'Los datos del monedero se actualizaron correctamente.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });
        this.regresar();
      },
      () => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: 'Ocurrió un error al actualizar el monedero.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });
      }
    );
  }

  moneyKeydown(e: KeyboardEvent) {
    const allowed = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Home', 'End'];
    if (allowed.includes(e.key)) return;
    const input = e.target as HTMLInputElement;
    const value = input.value || '';
    if (e.key === '.') {
      if (value.includes('.')) e.preventDefault();
      return;
    }
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
      return;
    }
    const selStart = input.selectionStart ?? value.length;
    const selEnd = input.selectionEnd ?? value.length;
    const newValue = value.slice(0, selStart) + e.key + value.slice(selEnd);
    const parts = newValue.split('.');
    if (parts[1] && parts[1].length > 2) e.preventDefault();
  }

  moneyInput(e: Event) {
    const input = e.target as HTMLInputElement;
    let v = (input.value || '').replace(',', '.');
    v = v.replace(/[^0-9.]/g, '');
    const firstDot = v.indexOf('.');
    if (firstDot !== -1) {
      const before = v.slice(0, firstDot + 1);
      const after = v.slice(firstDot + 1).replace(/\./g, '');
      v = before + after;
    }
    const parts = v.split('.');
    if (parts[1]) v = parts[0] + '.' + parts[1].slice(0, 2);
    input.value = v;
    this.monederoForm.get('saldo')?.setValue(v, { emitEvent: false });
  }

  moneyPaste(e: ClipboardEvent) {
    e.preventDefault();
    const input = e.target as HTMLInputElement;
    const text = (e.clipboardData?.getData('text') || '').replace(',', '.');

    let v = text.replace(/[^0-9.]/g, '');
    const firstDot = v.indexOf('.');
    if (firstDot !== -1) {
      const before = v.slice(0, firstDot + 1);
      const after = v.slice(firstDot + 1).replace(/\./g, '');
      v = before + after;
    }
    const parts = v.split('.');
    if (parts[1]) v = parts[0] + '.' + parts[1].slice(0, 2);

    input.value = v;
    this.monederoForm.get('saldo')?.setValue(v, { emitEvent: false });
  }

  moneyBlur(e: FocusEvent) {
    const input = e.target as HTMLInputElement;
    let v = input.value;
    if (!v) return;
    if (/^\d+$/.test(v)) {
      v = v + '.00';
    } else if (/^\d+\.\d$/.test(v)) {
      v = v + '0';
    } else if (/^\d+\.\d{2}$/.test(v)) {
    } else {
      v = v.replace(',', '.').replace(/[^0-9.]/g, '');
      const parts = v.split('.');
      v = parts[0] + (parts[1] ? '.' + parts[1].slice(0, 2) : '.00');
      if (/^\d+$/.test(v)) v = v + '.00';
      if (/^\d+\.\d$/.test(v)) v = v + '0';
    }
    input.value = v;
    this.monederoForm.get('saldo')?.setValue(v, { emitEvent: false });
  }

  regresar() {
    this.route.navigateByUrl('/administracion/monederos');
  }
}
