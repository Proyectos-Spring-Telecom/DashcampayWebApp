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
  selector: 'vex-registrar-mantenimiento-vehicular',
  templateUrl: './registrar-mantenimiento-vehicular.component.html',
  styleUrl: './registrar-mantenimiento-vehicular.component.scss',
  animations: [fadeInRight400ms]
})
export class RegistrarMantenimientoVehicularComponent implements OnInit {
  layoutCtrl = new UntypedFormControl('fullwidth');
  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public mantenimientoForm!: FormGroup;
  public title = 'Registrar Mantenimiento Vehicular';
  public showRequiredMsgs: boolean = false;
  public idMantenimiento: number | null = null;
  public isEditMode: boolean = false;

  // Listas para selects
  public listaInstalaciones: any[] = [];
  public listaReferencias: any[] = [];
  public listaTalleres: any[] = [];

  // Archivo
  @ViewChild('notaServicioInput') notaServicioInput!: ElementRef<HTMLInputElement>;
  public notaServicioFile: File | null = null;
  public notaServicioFileName: string = '';
  public notaServicioPreviewUrl: string | ArrayBuffer | null = null;
  public notaServicioDragging: boolean = false;

  constructor(
    private route: Router,
    private fb: FormBuilder,
    private mantenimientosService: MantenimientosService,
    private activatedRoute: ActivatedRoute,
    private alerts: AlertsService
  ) {}

  ngOnInit(): void {
    this.obtenerInstalaciones();
    this.obtenerReferencias();
    this.obtenerTalleres();
    this.initForm();
    
    this.activatedRoute.params.subscribe((params) => {
      this.idMantenimiento = params['id'] ? Number(params['id']) : null;
      if (this.idMantenimiento) {
        this.isEditMode = true;
        this.title = 'Actualizar Mantenimiento Vehicular';
        this.obtenerMantenimiento();
        // En modo edición, el archivo no es obligatorio
        this.mantenimientoForm.get('notaServicio')?.clearValidators();
        this.mantenimientoForm.get('notaServicio')?.updateValueAndValidity();
      }
    });
  }

  initForm() {
    this.mantenimientoForm = this.fb.group({
      idInstalacion: [null, Validators.required],
      idReferencia: [null, Validators.required],
      idTaller: [null, Validators.required],
      fechaInicio: [null, [Validators.required, this.fechaValidaValidator]],
      fechaFinal: [null, [Validators.required, this.fechaValidaValidator, this.fechaFinalMinValidator]],
      costo: [null, Validators.required],
      encargado: ['', Validators.required],
      servicioDescripcion: ['', Validators.required],
      notaServicio: [null, Validators.required],
      idEstatus: [1, Validators.required]
    });

    this.mantenimientoForm.get('fechaInicio')?.valueChanges.subscribe(() => {
      this.mantenimientoForm.get('fechaFinal')?.updateValueAndValidity({ emitEvent: false });
    });
  }

  /** Normaliza a medianoche local para comparar solo día. */
  private toDateOnly(value: unknown): Date | null {
    if (!value) return null;
    const d = value instanceof Date ? new Date(value.getTime()) : new Date(value as string | number);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private fechaValidaValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    if (control.value == null || control.value === '') return null;
    return this.toDateOnly(control.value) ? null : { fechaInvalida: true };
  };

  private fechaFinalMinValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const parent = control.parent;
    if (!parent) return null;
    const inicio = this.toDateOnly(parent.get('fechaInicio')?.value);
    const fin = this.toDateOnly(control.value);
    if (!inicio || !fin) return null;
    return fin < inicio ? { fechaMenor: true } : null;
  };

  get fechaInicioMinBound(): Date | null {
    return this.toDateOnly(this.mantenimientoForm?.get('fechaInicio')?.value);
  }

  get fechaFinalMaxBound(): Date | null {
    return this.toDateOnly(this.mantenimientoForm?.get('fechaFinal')?.value);
  }

  obtenerMantenimiento() {
    if (!this.idMantenimiento) return;

    this.loading = true;
    this.mantenimientosService.obtenerMantenimientoVehicularPorId(this.idMantenimiento).subscribe({
      next: (response: any) => {
        this.loading = false;

        const raw = response?.data ?? response;
        const data = Array.isArray(raw)
          ? (raw.find((x: any) => Number(x?.id) === Number(this.idMantenimiento)) ?? raw[0])
          : raw;

        if (!data) {
          this.alerts.open({
            type: 'warning',
            title: '¡Ops!',
            message: 'No se encontraron datos del mantenimiento.',
            confirmText: 'Confirmar',
            backdropClose: false
          });
          return;
        }

        this.patchMantenimientoForm(data);
      },
      error: (error) => {
        this.loading = false;
        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: 'Ocurrió un error al cargar los datos del mantenimiento.',
          confirmText: 'Confirmar',
          backdropClose: false
        });
        console.error('Error:');
        this.regresar();
      }
    });
  }

  private patchMantenimientoForm(data: any): void {
    const idInstalacion = data?.idInstalacion ?? data?.instalacion?.id ?? null;
    const idReferencia = data?.idReferencia ?? data?.referenciaServicio?.id ?? null;
    const idTaller = data?.idTaller ?? data?.taller?.id ?? null;
    const idEstatus = data?.idEstatus ?? data?.estatusMantenimiento?.id ?? 1;

    this.mantenimientoForm.patchValue({
      idInstalacion: idInstalacion != null ? Number(idInstalacion) : null,
      idReferencia: idReferencia != null ? Number(idReferencia) : null,
      idTaller: idTaller != null ? Number(idTaller) : null,
      fechaInicio: data?.fechaInicio ? new Date(data.fechaInicio) : null,
      fechaFinal: data?.fechaFinal ? new Date(data.fechaFinal) : null,
      costo: data?.costo != null ? Number(data.costo) : null,
      encargado: data?.encargado ?? '',
      servicioDescripcion: data?.servicioDescripcion ?? '',
      idEstatus: idEstatus != null ? Number(idEstatus) : 1
    });

    // Si hay una URL de imagen, mostrarla
    if (data?.notaServicio || data?.urlNotaServicio) {
      this.notaServicioPreviewUrl = data.notaServicio || data.urlNotaServicio;
      this.notaServicioFileName = data.nombreArchivo || 'Archivo existente';
    }
  }

  obtenerInstalaciones() {
    this.mantenimientosService.obtenerInstalaciones().subscribe({
      next: (response: any) => {
        this.listaInstalaciones = (response.data || response || []).map((item: any) => ({
          ...item,
          id: Number(item?.id ?? item?.Id ?? item?.ID)
        }));
      },
      error: (error: unknown) => {
        console.error('Error al obtener instalaciones:');
      }
    });
  }

  obtenerReferencias() {
    this.mantenimientosService.obtenerReferenciasServicio().subscribe({
      next: (response: any) => {
        this.listaReferencias = (response.data || response || []).map((item: any) => ({
          ...item,
          id: Number(item?.id ?? item?.Id ?? item?.ID)
        }));
      },
      error: (error: unknown) => {
        console.error('Error al obtener referencias:');
      }
    });
  }

  obtenerTalleres() {
    this.mantenimientosService.obtenerTalleres().subscribe({
      next: (response: any) => {
        this.listaTalleres = (response.data || response || []).map((item: any) => {
          const idNum = Number(item?.id ?? item?.Id ?? item?.ID ?? 0);
          return {
            ...item,
            id: Number.isFinite(idNum) ? idNum : 0,
            // Normalizar nombre para que funcione con mayúsculas o minúsculas
            nombre: item?.nombre ?? item?.Nombre ?? ''
          };
        });
      },
      error: (error: unknown) => {
        console.error('Error al obtener talleres:');
      }
    });
  }

  // Manejo de archivo notaServicio
  openNotaServicioFilePicker() {
    this.notaServicioInput?.nativeElement?.click();
  }

  onNotaServicioFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.handleNotaServicioFile(file);
    }
  }

  handleNotaServicioFile(file: File) {
    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
      this.alerts.open({
        type: 'error',
        title: '¡Error!',
        message: 'El archivo debe ser una imagen.',
        confirmText: 'Entendido',
        backdropClose: false
      });
      return;
    }

    this.notaServicioFile = file;
    this.notaServicioFileName = file.name;
    this.mantenimientoForm.patchValue({ notaServicio: file });

    // Preview de imagen
    const reader = new FileReader();
    reader.onload = (e) => {
      this.notaServicioPreviewUrl = e.target?.result || null;
    };
    reader.readAsDataURL(file);
  }

  clearNotaServicioFile(event: Event) {
    event.stopPropagation();
    this.notaServicioFile = null;
    this.notaServicioFileName = '';
    this.notaServicioPreviewUrl = null;
    this.mantenimientoForm.patchValue({ notaServicio: null });
    if (this.notaServicioInput?.nativeElement) {
      this.notaServicioInput.nativeElement.value = '';
    }
  }

  onNotaServicioDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.notaServicioDragging = true;
  }

  onNotaServicioDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.notaServicioDragging = false;
  }

  onNotaServicioDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.notaServicioDragging = false;

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      this.handleNotaServicioFile(file);
    }
  }

  async submit() {
    this.showRequiredMsgs = true;

    if (this.mantenimientoForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;

      const etiquetas: Record<string, string> = {
        idInstalacion: 'Instalación',
        idReferencia: 'Referencia',
        idTaller: 'Taller',
        fechaInicio: 'Fecha Inicio del Servicio',
        fechaFinal: 'Fecha Final del Servicio',
        costo: 'Costo',
        encargado: 'Encargado',
        servicioDescripcion: 'Descripción del Servicio',
        notaServicio: 'Nota de Servicio'
      };

      const mensajes: string[] = [];
      Object.keys(this.mantenimientoForm.controls).forEach((key) => {
        const control = this.mantenimientoForm.get(key);
        if (!control?.invalid || !control.errors) return;
        const label = etiquetas[key] || key;
        if (control.errors['required']) {
          mensajes.push(label);
        } else if (control.errors['fechaInvalida'] || control.errors['matDatepickerParse']) {
          mensajes.push(`${label}: fecha no válida`);
        } else if (control.errors['fechaMenor']) {
          mensajes.push('La fecha final no puede ser menor a la fecha de inicio');
        } else if (control.errors['matDatepickerMin']) {
          mensajes.push('La fecha final no puede ser menor a la fecha de inicio');
        } else if (control.errors['matDatepickerMax']) {
          mensajes.push('La fecha de inicio no puede ser mayor a la fecha final');
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

    const formValue = this.mantenimientoForm.getRawValue();
    const formData = new FormData();

    // Agregar campos al FormData
    formData.append('idInstalacion', String(formValue.idInstalacion));
    formData.append('idReferencia', String(formValue.idReferencia));
    formData.append('idTaller', String(formValue.idTaller));
    formData.append('costo', String(formValue.costo));
    formData.append('encargado', formValue.encargado);
    formData.append('servicioDescripcion', formValue.servicioDescripcion);
    formData.append('idEstatus', String(formValue.idEstatus || 1));

    // Formatear fechas
    if (formValue.fechaInicio) {
      const fechaInicio = new Date(formValue.fechaInicio);
      formData.append('fechaInicio', fechaInicio.toISOString());
    }
    if (formValue.fechaFinal) {
      const fechaFinal = new Date(formValue.fechaFinal);
      formData.append('fechaFinal', fechaFinal.toISOString());
    }

    // Agregar archivo solo si hay uno nuevo
    if (this.notaServicioFile) {
      formData.append('notaServicio', this.notaServicioFile, this.notaServicioFile.name);
    }

    const request = this.isEditMode && this.idMantenimiento
      ? this.mantenimientosService.actualizarMantenimientoVehicular(this.idMantenimiento, formData)
      : this.mantenimientosService.agregarMantenimientoVehicular(formData);

    request.subscribe({
      next: () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: this.isEditMode 
            ? 'Se actualizó el mantenimiento vehicular de manera exitosa.'
            : 'Se registró el mantenimiento vehicular de manera exitosa.',
          confirmText: 'Confirmar',
          backdropClose: false
        });
        this.regresar();
      },
      error: (error) => {
        this.submitButton = 'Guardar';
        this.loading = false;
        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: this.isEditMode
            ? 'Ocurrió un error al actualizar el mantenimiento vehicular.'
            : 'Ocurrió un error al registrar el mantenimiento vehicular.',
          confirmText: 'Confirmar',
          backdropClose: false
        });
        console.error('Error:');
      }
    });
  }

  regresar() {
    this.route.navigateByUrl('/administracion/mantenimientos/mantenimiento-vehicular');
  }

  allowOnlyNumbers(event: KeyboardEvent): boolean {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57) && charCode !== 46) {
      event.preventDefault();
      return false;
    }
    return true;
  }
}
