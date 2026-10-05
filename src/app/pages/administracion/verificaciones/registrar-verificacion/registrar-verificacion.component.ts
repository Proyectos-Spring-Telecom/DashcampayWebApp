import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  UntypedFormControl,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { MantenimientosService } from 'src/app/pages/services/mantenimientos.service';

@Component({
  selector: 'vex-registrar-verificacion',
  templateUrl: './registrar-verificacion.component.html',
  styleUrl: './registrar-verificacion.component.scss',
  animations: [fadeInRight400ms]
})
export class RegistrarVerificacionComponent implements OnInit {
  layoutCtrl = new UntypedFormControl('fullwidth');
  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public verificacionForm!: FormGroup;
  public title = 'Registrar Verificación';
  public showRequiredMsgs: boolean = false;
  public idVerificacion: number | null = null;
  public isEditMode: boolean = false;

  // Listas para selects
  public listaInstalaciones: any[] = [];
  public listaOperadores: any[] = [];
  public listaTiposVerificacion: any[] = [];

  // Flags para sincronizar carga de datos
  public instalacionesCargadas: boolean = false;
  public operadoresCargados: boolean = false;
  public tiposVerificacionCargados: boolean = false;
  public datosVerificacion: any = null;

  // Archivo
  @ViewChild('notaVerificacionInput') notaVerificacionInput!: ElementRef<HTMLInputElement>;
  public notaVerificacionFile: File | null = null;
  public notaVerificacionFileName: string = '';
  public notaVerificacionPreviewUrl: string | ArrayBuffer | null = null;
  public notaVerificacionDragging: boolean = false;

  constructor(
    private route: Router,
    private activatedRoute: ActivatedRoute,
    private fb: FormBuilder,
    private mantenimientosService: MantenimientosService,
    private alerts: AlertsService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.obtenerInstalaciones();
    this.obtenerOperadores();
    this.obtenerTiposVerificacion();
    
    this.activatedRoute.params.subscribe((params) => {
      this.idVerificacion = params['id'] ? Number(params['id']) : null;
      if (this.idVerificacion) {
        this.isEditMode = true;
        this.title = 'Actualizar Verificación';
        // En modo edición, el archivo no es obligatorio
        this.verificacionForm.get('notaVerificacion')?.clearValidators();
        this.verificacionForm.get('notaVerificacion')?.updateValueAndValidity();
        this.obtenerVerificacion();
      }
    });
  }

  initForm() {
    this.verificacionForm = this.fb.group({
      verificacionActual: [null, [Validators.required, this.fechaValidaValidator]],
      proximaVerificacion: [null, [Validators.required, this.fechaValidaValidator, this.proximaMinValidator]],
      idInstalacion: [null, Validators.required],
      idOperador: [null, Validators.required],
      notaVerificacion: [null, Validators.required],
      idTipoVerificacion: [null, Validators.required],
      evaluacion: ['{}'] // Oculto pero necesario para el API
    });

    this.verificacionForm.get('verificacionActual')?.valueChanges.subscribe(() => {
      this.verificacionForm.get('proximaVerificacion')?.updateValueAndValidity({ emitEvent: false });
    });
  }

  private toDateOnly(value: unknown): Date | null {
    if (value == null || value === '') return null;
    let d: Date;
    if (value instanceof Date) {
      d = new Date(value.getTime());
    } else {
      const s = String(value);
      // Fecha sola YYYY-MM-DD → local medianoche; ISO completo → Date normal
      d = /^\d{4}-\d{2}-\d{2}$/.test(s)
        ? new Date(`${s}T00:00:00`)
        : new Date(s);
    }
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private fechaValidaValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    if (control.value == null || control.value === '') return null;
    return this.toDateOnly(control.value) ? null : { fechaInvalida: true };
  };

  private proximaMinValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const parent = control.parent;
    if (!parent) return null;
    const actual = this.toDateOnly(parent.get('verificacionActual')?.value);
    const proxima = this.toDateOnly(control.value);
    if (!actual || !proxima) return null;
    return proxima < actual ? { fechaMenor: true } : null;
  };

  get verificacionActualMinBound(): Date | null {
    return this.toDateOnly(this.verificacionForm?.get('verificacionActual')?.value);
  }

  get proximaVerificacionMaxBound(): Date | null {
    return this.toDateOnly(this.verificacionForm?.get('proximaVerificacion')?.value);
  }

  private normalizeLista(response: any): any[] {
    const raw = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
    return raw.map((item: any) => ({
      ...item,
      id: Number(item?.id ?? item?.Id ?? item?.ID)
    }));
  }

  obtenerInstalaciones() {
    this.mantenimientosService.obtenerInstalaciones().subscribe({
      next: (response: any) => {
        this.listaInstalaciones = this.normalizeLista(response);
        this.instalacionesCargadas = true;
        if (this.datosVerificacion) {
          this.todosLosDatosCargados();
        }
      },
      error: (error) => {
        console.error('Error al obtener instalaciones:');
        this.instalacionesCargadas = true;
      }
    });
  }

  obtenerOperadores() {
    this.mantenimientosService.obtenerOperadores().subscribe({
      next: (response: any) => {
        this.listaOperadores = this.normalizeLista(response);
        this.operadoresCargados = true;
        if (this.datosVerificacion) {
          this.todosLosDatosCargados();
        }
      },
      error: (error) => {
        console.error('Error al obtener operadores:');
        this.operadoresCargados = true;
      }
    });
  }

  obtenerTiposVerificacion() {
    this.mantenimientosService.obtenerTiposVerificacion().subscribe({
      next: (response: any) => {
        this.listaTiposVerificacion = this.normalizeLista(response);
        this.tiposVerificacionCargados = true;
        if (this.datosVerificacion) {
          this.todosLosDatosCargados();
        }
      },
      error: (error) => {
        console.error('Error al obtener tipos de verificación:');
        this.tiposVerificacionCargados = true;
      }
    });
  }

  obtenerVerificacion() {
    if (!this.idVerificacion) return;

    this.loading = true;
    this.mantenimientosService.obtenerVerificacionPorId(this.idVerificacion).subscribe({
      next: (response: any) => {
        const raw = response?.data ?? response;
        const data = Array.isArray(raw)
          ? (raw.find((x: any) => Number(x?.id) === Number(this.idVerificacion)) ?? raw[0])
          : raw;

        this.loading = false;

        if (!data) {
          this.alerts.open({
            type: 'warning',
            title: '¡Ops!',
            message: 'No se encontraron datos de la verificación.',
            confirmText: 'Confirmar',
            backdropClose: false
          });
          return;
        }

        if (this.todosLosDatosCargados()) {
          this.llenarFormulario(data);
        } else {
          this.datosVerificacion = data;
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('Error:');
        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: 'Ocurrió un error al cargar los datos de la verificación.',
          confirmText: 'Confirmar',
          backdropClose: false
        });
        this.cancelar();
      }
    });
  }

  todosLosDatosCargados(): boolean {
    const todosCargados = this.instalacionesCargadas && this.operadoresCargados && this.tiposVerificacionCargados;

    if (todosCargados && this.datosVerificacion) {
      const datos = this.datosVerificacion;
      this.datosVerificacion = null;
      this.llenarFormulario(datos);
    }

    return todosCargados;
  }

  llenarFormulario(data: any) {
    if (Array.isArray(data) && data.length > 0) {
      data = data.find((x: any) => Number(x?.id) === Number(this.idVerificacion)) ?? data[0];
    }

    const idInstalacion =
      data?.idInstalacion ??
      data?.IdInstalacion ??
      data?.instalacion?.id ??
      data?.Instalacion?.id ??
      null;
    const idOperador =
      data?.idOperador ??
      data?.IdOperador ??
      data?.operador?.id ??
      data?.Operador?.id ??
      null;
    const idTipoVerificacion =
      data?.idTipoVerificacion ??
      data?.IdTipoVerificacion ??
      data?.tipoVerificacion?.id ??
      data?.TipoVerificacion?.id ??
      null;
    const verificacionActual = data?.verificacionActual ?? data?.VerificacionActual ?? null;
    const proximaVerificacion = data?.proximaVerificacion ?? data?.ProximaVerificacion ?? null;
    const notaVerificacion = data?.notaVerificacion ?? data?.NotaVerificacion ?? null;
    const evaluacion = data?.evaluacion ?? data?.Evaluacion ?? '{}';

    const formValues: any = {
      idInstalacion: idInstalacion != null ? Number(idInstalacion) : null,
      idOperador: idOperador != null ? Number(idOperador) : null,
      idTipoVerificacion: idTipoVerificacion != null ? Number(idTipoVerificacion) : null,
      verificacionActual: this.toDateOnly(verificacionActual),
      proximaVerificacion: this.toDateOnly(proximaVerificacion),
      evaluacion: evaluacion != null
        ? (typeof evaluacion === 'string' ? evaluacion : JSON.stringify(evaluacion))
        : '{}'
    };

    Object.keys(formValues).forEach((key) => {
      const control = this.verificacionForm.get(key);
      if (control) {
        control.setValue(formValues[key], { emitEvent: false });
      }
    });

    if (notaVerificacion && typeof notaVerificacion === 'string') {
      this.notaVerificacionPreviewUrl = notaVerificacion;
      this.notaVerificacionFileName = 'Nota de verificación';
      this.verificacionForm.get('notaVerificacion')?.clearValidators();
      this.verificacionForm.get('notaVerificacion')?.updateValueAndValidity();
    }

    setTimeout(() => {
      this.verificacionForm.updateValueAndValidity({ emitEvent: false });
    }, 100);
  }

  openNotaVerificacionFilePicker() {
    if (this.notaVerificacionInput?.nativeElement) {
      this.notaVerificacionInput.nativeElement.click();
    }
  }

  onNotaVerificacionFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleNotaVerificacionFile(input.files[0]);
    }
  }

  handleNotaVerificacionFile(file: File) {
    if (!file.type.startsWith('image/')) {
      this.alerts.open({
        type: 'error',
        title: 'Error',
        message: 'El archivo debe ser una imagen.',
        confirmText: 'Entendido'
      });
      return;
    }

    this.notaVerificacionFile = file;
    this.notaVerificacionFileName = file.name;
    this.verificacionForm.patchValue({ notaVerificacion: file });

    // Preview de imagen
    const reader = new FileReader();
    reader.onload = (e) => {
      this.notaVerificacionPreviewUrl = e.target?.result || null;
    };
    reader.readAsDataURL(file);
  }

  clearNotaVerificacionFile(event: Event) {
    event.stopPropagation();
    this.notaVerificacionFile = null;
    this.notaVerificacionFileName = '';
    this.notaVerificacionPreviewUrl = null;
    this.verificacionForm.patchValue({ notaVerificacion: null });
    if (this.notaVerificacionInput?.nativeElement) {
      this.notaVerificacionInput.nativeElement.value = '';
    }
  }

  onNotaVerificacionDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.notaVerificacionDragging = true;
  }

  onNotaVerificacionDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.notaVerificacionDragging = false;
  }

  onNotaVerificacionDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.notaVerificacionDragging = false;

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      this.handleNotaVerificacionFile(file);
    }
  }

  async submit() {
    this.showRequiredMsgs = true;

    if (this.verificacionForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;

      const etiquetas: Record<string, string> = {
        verificacionActual: 'Fecha de Verificación Actual',
        proximaVerificacion: 'Fecha de Próxima Verificación',
        idInstalacion: 'Instalación',
        idOperador: 'Operador',
        notaVerificacion: 'Nota de Verificación',
        idTipoVerificacion: 'Tipo de Verificación',
        evaluacion: 'Evaluación'
      };

      const mensajes: string[] = [];
      Object.keys(this.verificacionForm.controls).forEach((key) => {
        const control = this.verificacionForm.get(key);
        if (!control?.invalid || !control.errors) return;
        const label = etiquetas[key] || key;
        if (control.errors['required']) {
          mensajes.push(label);
        } else if (control.errors['fechaInvalida'] || control.errors['matDatepickerParse']) {
          mensajes.push(`${label}: fecha no válida`);
        } else if (control.errors['fechaMenor'] || control.errors['matDatepickerMin']) {
          mensajes.push('La próxima verificación no puede ser menor a la verificación actual');
        } else if (control.errors['matDatepickerMax']) {
          mensajes.push('La verificación actual no puede ser mayor a la próxima verificación');
        }
      });

      const lista = mensajes.map((campo, i) => `
        <div style="padding:8px 12px; border-left:4px solid #d9534f; background:#caa8a8; text-align:center; margin-bottom:8px; border-radius:4px;">
          <strong style="color:#b02a37;">${i + 1}. ${campo}</strong>
        </div>
      `).join('');

      await this.alerts.open({
        type: 'warning',
        title: '¡Ops!',
        message: `
          <p style="text-align:center; font-size:15px; margin-bottom:16px;">
            Hay campos con errores de validación.
          </p>
          <div style="max-height:350px; overflow-y:auto;">${lista}</div>
        `,
        confirmText: 'Entendido',
        backdropClose: false
      });
      return;
    }

    this.submitButton = 'Cargando...';
    this.loading = true;

    const formValue = this.verificacionForm.getRawValue();
    const formData = new FormData();

    // Agregar campos al FormData
    formData.append('verificacionActual', this.formatDate(formValue.verificacionActual));
    formData.append('proximaVerificacion', this.formatDate(formValue.proximaVerificacion));
    formData.append('idInstalacion', String(formValue.idInstalacion));
    formData.append('idOperador', String(formValue.idOperador));
    formData.append('idTipoVerificacion', String(formValue.idTipoVerificacion));
    
    if (formValue.notaVerificacion) {
      formData.append('notaVerificacion', formValue.notaVerificacion);
    }

    // Validar y agregar evaluación como JSON
    try {
      const evaluacionObj = typeof formValue.evaluacion === 'string' 
        ? JSON.parse(formValue.evaluacion) 
        : formValue.evaluacion;
      formData.append('evaluacion', JSON.stringify(evaluacionObj));
    } catch (error) {
      await this.alerts.open({
        type: 'error',
        title: 'Error',
        message: 'El campo evaluación debe ser un JSON válido.',
        confirmText: 'Entendido'
      });
      this.submitButton = 'Guardar';
      this.loading = false;
      return;
    }

    const request = this.isEditMode && this.idVerificacion
      ? this.mantenimientosService.actualizarVerificacion(this.idVerificacion, formData)
      : this.mantenimientosService.agregarVerificacion(formData);

    request.subscribe({
      next: async (response: any) => {
        this.loading = false;
        this.submitButton = 'Guardar';
        
        await this.alerts.open({
          type: 'success',
          title: '¡Éxito!',
          message: this.isEditMode 
            ? 'La verificación se ha actualizado correctamente.'
            : 'La verificación se ha registrado correctamente.',
          confirmText: 'Aceptar'
        });

        this.route.navigate(['/administracion/verificaciones']);
      },
      error: async (error) => {
        this.loading = false;
        this.submitButton = 'Guardar';
        
        const errorMessage = error?.error?.message || error?.message || 
          (this.isEditMode ? 'Error al actualizar la verificación.' : 'Error al registrar la verificación.');
        
        await this.alerts.open({
          type: 'error',
          title: 'Error',
          message: errorMessage,
          confirmText: 'Entendido'
        });
      }
    });
  }

  formatDate(date: Date | null): string {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:00.000Z`;
  }

  cancelar() {
    this.route.navigate(['/administracion/verificaciones']);
  }
}

