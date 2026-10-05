import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, UntypedFormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { TarifasService } from 'src/app/pages/services/tarifa.service';
import { VariantesService } from 'src/app/pages/services/variantes.service';

@Component({
  selector: 'vex-agregar-tarifa',
  templateUrl: './agregar-tarifa.component.html',
  styleUrl: './agregar-tarifa.component.scss',
  animations: [fadeInRight400ms],
})
export class AgregarTarifaComponent implements OnInit {
  layoutCtrl = new UntypedFormControl('fullwidth');
  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public tarifaForm!: FormGroup;
  public idTarifa!: number;
  public title = 'Agregar Tarifa';
  public listaVariantes: any[] = [];
  public listaTiposTarifa: Array<{ id: number; nombre: string }> = [];
  public maxCantidadEstacionesBase = 0;
  selectedFileName: string = '';
  previewUrl: string | ArrayBuffer | null = null;

  constructor(
    private fb: FormBuilder,
    private tarSerice: TarifasService,
    private activatedRouted: ActivatedRoute,
    private varService: VariantesService,
    private route: Router,
    private alerts: AlertsService,
  ) { }

  ngOnInit(): void {
    this.initForm();
    this.obtenerTiposTarifa();
    this.obtenerVariantes();
    this.activatedRouted.params.subscribe((params) => {
      this.idTarifa = params['idTarifa'];
      if (this.idTarifa) {
        this.title = 'Actualizar Tarifa';
        this.submitButton = 'Actualizar';
        this.obtenerTarifa();
      }
    });
  }

  esTipoTarifaEstacionaria(): boolean {
    const idTipoTarifa = this.tarifaForm?.get('idTipoTarifa')?.value;
    if (!idTipoTarifa) return false;
    const tipoTarifa = this.listaTiposTarifa.find(t => t.id === idTipoTarifa);
    const nombreTipo = tipoTarifa?.nombre?.toLowerCase() || '';
    return nombreTipo.includes('estacionaria') || nombreTipo.includes('estacionario');
  }

  obtenerTiposTarifa(): void {
    this.tarSerice.obtenerTiposTarifa().subscribe({
      next: (response: any) => {
        const data = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
        this.listaTiposTarifa = data.map((t: any) => ({
          id: Number(t?.id ?? t?.Id ?? t?.ID ?? 0),
          nombre: t?.nombre ?? t?.Nombre ?? ''
        })).filter((t: any) => Number.isFinite(t.id) && t.id > 0);

        const idTipo = this.tarifaForm?.get('idTipoTarifa')?.value;
        if (idTipo) this.actualizarCamposSegunTipo(idTipo);
      },
      error: () => {
        this.listaTiposTarifa = [];
      }
    });
  }

  obtenerVariantes() {
    this.varService.obtenerVariantes().subscribe((response) => {
      const raw = response?.data ?? response ?? [];
      this.listaVariantes = (Array.isArray(raw) ? raw : []).map((v: any) => ({
        ...v,
        id: Number(v?.id ?? v?.idVariante),
        nombreVariante: v?.nombreVariante ?? v?.nombreVariantes ?? v?.nombre ?? '',
      }));

      const idVariante = this.tarifaForm?.get('idVariante')?.value;
      if (idVariante) this.actualizarMaxEstacionesPorVariante(idVariante);
    });
  }

  private toNumber(v: any): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(String(v).replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  obtenerTarifa() {
    this.tarSerice.obtenerTarifa(this.idTarifa).subscribe({
      next: (response: any) => {
        const data = response?.data;
        const item = Array.isArray(data)
          ? (data.find((x: any) => x?.id === this.idTarifa || Number(x?.id) === Number(this.idTarifa)) ?? data[0])
          : data;

        if (!item) { return; }
        const idVariante = item.idVariante != null
          ? Number(item.idVariante)
          : item.idVariantes != null
            ? Number(item.idVariantes)
            : null;
        const idTipoTarifa = item.idTipoTarifa != null
          ? Number(item.idTipoTarifa)
          : item.idTipoTarifas != null
            ? Number(item.idTipoTarifas)
            : null;

        const dto = {
          idTipoTarifa,
          tarifaBase: this.toNumber(item.tarifaBase ?? item.TarifaBase),
          distanciaBaseKm: this.toNumber(item.distanciaBaseKm ?? item.DistanciaBaseKm),
          cantidadEstacionesBase: this.toNumber(item.cantidadEstacionesBase ?? item.CantidadEstacionesBase),
          incrementoCadaMetros: this.toNumber(item.incrementoCadaMetros ?? item.IncrementoCadaMetros),
          costoAdicional: this.toNumber(item.costoAdicional ?? item.CostoAdicional),
          costoPorEstacion: this.toNumber(item.costoPorEstacion ?? item.CostoPorEstacion),
          estatus: (item.estatus ?? item.estatusTarifa ?? 1),
          idVariante,
        };

        this.tarifaForm.patchValue(dto, { emitEvent: false });
        this.actualizarMaxEstacionesPorVariante(idVariante);
        this.actualizarCamposSegunTipo(idTipoTarifa);
      },
      error: (e) => {
        console.error('Error obtenerTarifa');
      }
    });
  }

  private toNum(v: any): number {
    if (v === null || v === undefined) return NaN;
    if (typeof v === 'string') v = v.replace(',', '.').trim();
    return Number(v);
  }

  initForm() {
    this.tarifaForm = this.fb.group({
      idTipoTarifa: [null, Validators.required],
      idVariante: [null, Validators.required],
      tarifaBase: [null, [Validators.required, Validators.min(0)]],
      cantidadEstacionesBase: [{ value: null, disabled: true }, [Validators.min(0)]],
      distanciaBaseKm: [{ value: null, disabled: true }, [Validators.min(0)]],
      incrementoCadaMetros: [{ value: null, disabled: true }, [Validators.min(0)]],
      costoAdicional: [{ value: null, disabled: true }, [Validators.min(0)]],
      costoPorEstacion: [{ value: null, disabled: true }, [Validators.min(0)]],
      estatus: [1, Validators.required],
    });

    this.tarifaForm.get('idTipoTarifa')?.valueChanges.subscribe((idTipoTarifa) => {
      this.actualizarCamposSegunTipo(idTipoTarifa);
    });

    this.tarifaForm.get('idVariante')?.valueChanges.subscribe((idVariante) => {
      this.actualizarMaxEstacionesPorVariante(idVariante);
      if (this.esTipoTarifaEstacionaria()) {
        this.tarifaForm.get('cantidadEstacionesBase')?.updateValueAndValidity({ onlySelf: true });
      }
    });
  }

  private actualizarMaxEstacionesPorVariante(idVariante: number | null): void {
    const variante = this.listaVariantes.find(v => Number(v.id) === Number(idVariante));
    const recorrido = variante?.recorridoDetallado;
    this.maxCantidadEstacionesBase = Array.isArray(recorrido) ? recorrido.length : 0;
  }

  private cantidadEstacionesBaseMaxValidator() {
    return (control: any) => {
      if (this.maxCantidadEstacionesBase <= 0) return null;
      const n = Number(control?.value);
      if (!Number.isFinite(n)) return null;
      return n > this.maxCantidadEstacionesBase
        ? { cantidadEstacionesBaseMax: true }
        : null;
    };
  }

  actualizarCamposSegunTipo(idTipoTarifa: number | null): void {
    const distanciaControl = this.tarifaForm.get('distanciaBaseKm');
    const incrementoControl = this.tarifaForm.get('incrementoCadaMetros');
    const costoControl = this.tarifaForm.get('costoAdicional');
    const tarifaBaseControl = this.tarifaForm.get('tarifaBase');
    const costoPorEstacionControl = this.tarifaForm.get('costoPorEstacion');
    const cantidadEstacionesBaseControl = this.tarifaForm.get('cantidadEstacionesBase');

    const clearAndDisable = (ctrl: any) => {
      ctrl?.clearValidators();
      ctrl?.enable({ emitEvent: false });
      ctrl?.setValue(null, { emitEvent: false });
      ctrl?.disable({ emitEvent: false });
      ctrl?.updateValueAndValidity({ onlySelf: true });
    };

    if (!idTipoTarifa) {
      clearAndDisable(distanciaControl);
      clearAndDisable(incrementoControl);
      clearAndDisable(costoControl);
      clearAndDisable(costoPorEstacionControl);
      clearAndDisable(cantidadEstacionesBaseControl);
      return;
    }

    const tipoTarifa = this.listaTiposTarifa.find(t => t.id === idTipoTarifa);
    const nombreTipo = tipoTarifa?.nombre?.toLowerCase() || '';

    if (nombreTipo.includes('estacionaria') || nombreTipo.includes('estacionario')) {
      clearAndDisable(distanciaControl);
      clearAndDisable(incrementoControl);
      clearAndDisable(costoControl);

      tarifaBaseControl?.enable({ emitEvent: false });
      tarifaBaseControl?.setValidators([Validators.required, Validators.min(0)]);

      cantidadEstacionesBaseControl?.enable({ emitEvent: false });
      cantidadEstacionesBaseControl?.setValidators([
        Validators.required,
        Validators.min(0),
        this.cantidadEstacionesBaseMaxValidator(),
      ]);

      costoPorEstacionControl?.enable({ emitEvent: false });
      costoPorEstacionControl?.setValidators([Validators.required, Validators.min(0)]);
    } else if (nombreTipo.includes('fija') || nombreTipo.includes('fijo')) {
      tarifaBaseControl?.enable({ emitEvent: false });
      tarifaBaseControl?.setValidators([Validators.required, Validators.min(0)]);
      clearAndDisable(cantidadEstacionesBaseControl);
      clearAndDisable(distanciaControl);
      clearAndDisable(incrementoControl);
      clearAndDisable(costoControl);
      clearAndDisable(costoPorEstacionControl);
    } else if (nombreTipo.includes('incremental')) {
      tarifaBaseControl?.enable({ emitEvent: false });
      tarifaBaseControl?.setValidators([Validators.required, Validators.min(0)]);
      clearAndDisable(cantidadEstacionesBaseControl);
      clearAndDisable(costoPorEstacionControl);

      distanciaControl?.enable({ emitEvent: false });
      incrementoControl?.enable({ emitEvent: false });
      costoControl?.enable({ emitEvent: false });
      distanciaControl?.setValidators([Validators.required, Validators.min(0)]);
      incrementoControl?.setValidators([Validators.required, Validators.min(0)]);
      costoControl?.setValidators([Validators.required, Validators.min(0)]);
    }

    tarifaBaseControl?.updateValueAndValidity({ onlySelf: true });
    cantidadEstacionesBaseControl?.updateValueAndValidity({ onlySelf: true });
    distanciaControl?.updateValueAndValidity({ onlySelf: true });
    incrementoControl?.updateValueAndValidity({ onlySelf: true });
    costoControl?.updateValueAndValidity({ onlySelf: true });
    costoPorEstacionControl?.updateValueAndValidity({ onlySelf: true });
  }

  private buildPayloadFromForm(): any {
    const v = this.tarifaForm.getRawValue();
    const tipoTarifa = this.listaTiposTarifa.find(t => t.id === v.idTipoTarifa);
    const nombreTipo = tipoTarifa?.nombre?.toLowerCase() || '';
    const esFija = nombreTipo.includes('fija') || nombreTipo.includes('fijo');
    const esEstacionaria = nombreTipo.includes('estacionaria') || nombreTipo.includes('estacionario');

    const payload: any = {
      idTipoTarifa: this.toNum(v.idTipoTarifa),
      estatus: this.toNum(v.estatus),
      idVariante: this.toNum(v.idVariante),
      tarifaBase: this.toNum(v.tarifaBase),
    };

    if (esEstacionaria) {
      payload.cantidadEstacionesBase = this.toNum(v.cantidadEstacionesBase);
      payload.costoPorEstacion = this.toNum(v.costoPorEstacion);
    } else if (!esFija) {
      payload.distanciaBaseKm = this.toNum(v.distanciaBaseKm);
      payload.incrementoCadaMetros = this.toNum(v.incrementoCadaMetros);
      payload.costoAdicional = this.toNum(v.costoAdicional);
    }

    return payload;
  }

  private getValidationMissingLabels(): string[] {
    const etiquetas: Record<string, string> = {
      idTipoTarifa: 'Tipo Tarifa',
      idVariante: 'Variante',
      tarifaBase: 'Tarifa Base',
      distanciaBaseKm: 'Distancia Base Km',
      cantidadEstacionesBase: 'Cantidad Estaciones Base',
      incrementoCadaMetros: 'Incremento Por Metros',
      costoAdicional: 'Costo Adicional',
      costoPorEstacion: 'Costo por Estación',
    };

    const camposFaltantes: string[] = [];
    Object.keys(this.tarifaForm.controls).forEach((key) => {
      const control = this.tarifaForm.get(key);
      if (control?.disabled) return;
      if (control?.errors?.['required']) {
        camposFaltantes.push(etiquetas[key] || key);
      }
      if (key === 'cantidadEstacionesBase' && control?.errors?.['cantidadEstacionesBaseMax']) {
        camposFaltantes.push(`Cantidad Estaciones Base (máx. ${this.maxCantidadEstacionesBase})`);
      }
    });
    return camposFaltantes;
  }

  private getErrorMessage(err: any): string {
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
        if (Array.isArray(value.message)) return flatten(value.message);
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

    return 'Ocurrió un error al procesar la tarifa.';
  }

  submit() {
    this.submitButton = 'Cargando...';
    this.loading = true;
    if (this.idTarifa) {
      this.actualizar();
    } else {
      this.agregar();
    }
  }

  async agregar() {
    this.submitButton = 'Cargando...';
    this.loading = true;
    this.tarifaForm.markAllAsTouched();

    if (this.tarifaForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;

      const camposFaltantes = this.getValidationMissingLabels();
      const lista = camposFaltantes
        .map(
          (campo, index) => `
        <div style="padding: 8px 12px; border-left: 4px solid #d9534f;
                    background: #caa8a8; text-align: center; margin-bottom: 8px;
                    border-radius: 4px;">
          <strong style="color: #b02a37;">${index + 1}. ${campo}</strong>
        </div>`
        )
        .join('');

      await this.alerts.open({
        type: 'warning',
        title: '¡Ops!',
        message: `
        <p style="text-align: center; font-size: 15px; margin-bottom: 16px; color: white">
          Hay campos que requieren atención.<br>
        </p>
        <div style="max-height: 350px; overflow-y: auto;">${lista}</div>
      `,
        confirmText: 'Entendido',
        backdropClose: false,
      });
      return;
    }

    if (this.tarifaForm.contains('id')) this.tarifaForm.removeControl('id');

    const payload = this.buildPayloadFromForm();

    this.tarSerice.agregarTarifa(payload).subscribe(
      () => {
        this.submitButton = 'Guardar';
        this.loading = false;

        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'Se agregó una nueva tarifa de manera exitosa.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });

        this.regresar();
      },
      (error) => {
        this.submitButton = 'Guardar';
        this.loading = false;

        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: this.getErrorMessage(error),
          confirmText: 'Confirmar',
          backdropClose: false,
        });
      }
    );
  }

  async actualizar() {
    this.submitButton = 'Cargando...';
    this.loading = true;
    this.tarifaForm.markAllAsTouched();

    if (this.tarifaForm.invalid) {
      this.submitButton = 'Actualizar';
      this.loading = false;

      const camposFaltantes = this.getValidationMissingLabels();
      const lista = camposFaltantes
        .map(
          (campo, index) => `
        <div style="padding: 8px 12px; border-left: 4px solid #d9534f;
                    background: #caa8a8; text-align: center; margin-bottom: 8px;
                    border-radius: 4px;">
          <strong style="color: #b02a37;">${index + 1}. ${campo}</strong>
        </div>`
        )
        .join('');

      await this.alerts.open({
        type: 'warning',
        title: '¡Ops!',
        message: `
        <p style="text-align: center; font-size: 15px; margin-bottom: 16px; color: white">
          Hay campos que requieren atención.<br>
        </p>
        <div style="max-height: 350px; overflow-y: auto;">${lista}</div>
      `,
        confirmText: 'Entendido',
        backdropClose: false,
      });
      return;
    }

    const payload = this.buildPayloadFromForm();

    this.tarSerice.actualizarTarifa(this.idTarifa, payload).subscribe(
      () => {
        this.submitButton = 'Actualizar';
        this.loading = false;

        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'Los datos de la tarifa se actualizaron correctamente.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });

        this.regresar();
      },
      (error) => {
        this.submitButton = 'Actualizar';
        this.loading = false;

        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: this.getErrorMessage(error),
          confirmText: 'Confirmar',
          backdropClose: false,
        });
      }
    );
  }

  regresar() {
    this.route.navigateByUrl('/administracion/tarifas');
  }

  // ✅ Utilidad: normaliza a string válido "123.45"
  private normalizeMoneyString(raw: string): string {
    let v = (raw || '').replace(',', '.').replace(/[^0-9.]/g, '');
    const firstDot = v.indexOf('.');
    if (firstDot !== -1) {
      const before = v.slice(0, firstDot + 1);
      const after = v.slice(firstDot + 1).replace(/\./g, '');
      v = before + after;
    }
    const parts = v.split('.');
    if (parts[1]) v = parts[0] + '.' + parts[1].slice(0, 2);
    return v;
  }

  // ✅ Utilidad: setea SIEMPRE number (o null) al form control, sin disparar eventos
  private setTarifaBaseNumberFromString(v: string) {
    const normalized = this.normalizeMoneyString(v);
    if (normalized === '' || normalized === '.') {
      this.tarifaForm.get('tarifaBase')?.setValue(null, { emitEvent: false });
      return null;
    }
    const n = Number(normalized);
    if (Number.isFinite(n)) {
      this.tarifaForm.get('tarifaBase')?.setValue(n, { emitEvent: false });
      return n;
    } else {
      this.tarifaForm.get('tarifaBase')?.setValue(null, { emitEvent: false });
      return null;
    }
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
    // Normaliza visualmente (string)...
    const normalized = this.normalizeMoneyString(input.value);
    input.value = normalized;
    // ...pero guarda SIEMPRE número en el form control
    this.setTarifaBaseNumberFromString(normalized);
  }

  moneyPaste(e: ClipboardEvent) {
    e.preventDefault();
    const input = e.target as HTMLInputElement;
    const text = e.clipboardData?.getData('text') || '';
    const normalized = this.normalizeMoneyString(text);
    input.value = normalized;
    this.setTarifaBaseNumberFromString(normalized);
  }

  moneyBlur(e: FocusEvent) {
    const input = e.target as HTMLInputElement;
    const n = this.setTarifaBaseNumberFromString(input.value); // asegura number en el form
    if (n == null) {
      input.value = '';
      return;
    }
    // Formato visual fijo a 2 decimales, pero el form ya tiene number
    input.value = n.toFixed(2);
  }


  costoKeydown(e: KeyboardEvent) {
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

  costoInput(e: Event) {
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
    this.tarifaForm.get('costoAdicional')?.setValue(v, { emitEvent: false });
  }

  costoPaste(e: ClipboardEvent) {
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
    this.tarifaForm.get('costoAdicional')?.setValue(v, { emitEvent: false });
  }

  costoBlur(e: FocusEvent) {
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
    this.tarifaForm.get('costoAdicional')?.setValue(v, { emitEvent: false });
  }

  incrementoKeydown(e: KeyboardEvent) {
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
    }
  }

  incrementoInput(e: Event) {
    const input = e.target as HTMLInputElement;
    let v = (input.value || '').replace(',', '.');
    v = v.replace(/[^0-9.]/g, '');
    const firstDot = v.indexOf('.');
    if (firstDot !== -1) {
      const before = v.slice(0, firstDot + 1);
      const after = v.slice(firstDot + 1).replace(/\./g, '');
      v = before + after;
    }
    input.value = v;
    this.tarifaForm.get('incrementoCadaMetros')?.setValue(v, { emitEvent: false });
  }

  incrementoPaste(e: ClipboardEvent) {
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
    input.value = v;
    this.tarifaForm.get('incrementoCadaMetros')?.setValue(v, { emitEvent: false });
  }

  distanciaKeydown(e: KeyboardEvent) {
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
    }
  }

  distanciaInput(e: Event) {
    const input = e.target as HTMLInputElement;
    let v = (input.value || '').replace(',', '.');
    v = v.replace(/[^0-9.]/g, '');
    const firstDot = v.indexOf('.');
    if (firstDot !== -1) {
      const before = v.slice(0, firstDot + 1);
      const after = v.slice(firstDot + 1).replace(/\./g, '');
      v = before + after;
    }
    input.value = v;
    this.tarifaForm.get('distanciaBaseKm')?.setValue(v, { emitEvent: false });
  }

  distanciaPaste(e: ClipboardEvent) {
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
    input.value = v;
    this.tarifaForm.get('distanciaBaseKm')?.setValue(v, { emitEvent: false });
  }

  estacionesKeydown(e: KeyboardEvent) {
    const allowed = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Home', 'End'];
    if (allowed.includes(e.key)) return;
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  }

  estacionesInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const v = (input.value || '').replace(/[^0-9]/g, '');
    input.value = v;
    const n = v === '' ? null : Number(v);
    this.tarifaForm.get('cantidadEstacionesBase')?.setValue(n, { emitEvent: false });
  }

  estacionesPaste(e: ClipboardEvent) {
    e.preventDefault();
    const input = e.target as HTMLInputElement;
    const v = (e.clipboardData?.getData('text') || '').replace(/[^0-9]/g, '');
    input.value = v;
    const n = v === '' ? null : Number(v);
    this.tarifaForm.get('cantidadEstacionesBase')?.setValue(n, { emitEvent: false });
  }

  private setCostoPorEstacionFromString(raw: string): number | null {
    const normalized = this.normalizeMoneyString(raw);
    if (normalized === '' || normalized === '.') {
      this.tarifaForm.get('costoPorEstacion')?.setValue(null, { emitEvent: false });
      return null;
    }
    const n = Number(normalized);
    if (Number.isFinite(n)) {
      this.tarifaForm.get('costoPorEstacion')?.setValue(n, { emitEvent: false });
      return n;
    }
    this.tarifaForm.get('costoPorEstacion')?.setValue(null, { emitEvent: false });
    return null;
  }

  costoPorEstacionInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const normalized = this.normalizeMoneyString(input.value);
    input.value = normalized;
    this.setCostoPorEstacionFromString(normalized);
  }

  costoPorEstacionPaste(e: ClipboardEvent) {
    e.preventDefault();
    const input = e.target as HTMLInputElement;
    const normalized = this.normalizeMoneyString(e.clipboardData?.getData('text') || '');
    input.value = normalized;
    this.setCostoPorEstacionFromString(normalized);
  }

  costoPorEstacionBlur(e: FocusEvent) {
    const input = e.target as HTMLInputElement;
    const n = this.setCostoPorEstacionFromString(input.value);
    if (n == null) {
      input.value = '';
      return;
    }
    input.value = n.toFixed(2);
  }

}
