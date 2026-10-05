import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  UntypedFormControl,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { MantenimientosService } from 'src/app/pages/services/mantenimientos.service';

@Component({
  selector: 'vex-registrar-incidente',
  standalone: false,
  templateUrl: './registrar-incidente.component.html',
  styleUrl: './registrar-incidente.component.scss',
  animations: [fadeInRight400ms]
})
export class RegistrarIncidenteComponent implements OnInit {
  layoutCtrl = new UntypedFormControl('fullwidth');
  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public incidenteForm!: FormGroup;
  public title = 'Registrar Incidente';
  public showRequiredMsgs: boolean = false;
  public idIncidente: number | null = null;
  public isEditMode: boolean = false;

  // Listas para selects
  public listaInstalaciones: any[] = [];
  public listaOperadores: any[] = [];

  // Flags para sincronizar carga de datos
  public instalacionesCargadas: boolean = false;
  public operadoresCargados: boolean = false;
  public datosIncidente: any = null;

  // Archivo
  @ViewChild('imagenInput') imagenInput!: ElementRef<HTMLInputElement>;
  public imagenFile: File | null = null;
  public imagenFileName: string = '';
  public imagenPreviewUrl: string | ArrayBuffer | null = null;
  public imagenDragging: boolean = false;

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

    this.activatedRoute.params.subscribe((params) => {
      this.idIncidente = params['id'] ? Number(params['id']) : null;
      if (this.idIncidente) {
        this.isEditMode = true;
        this.title = 'Actualizar Incidente';
        // En modo edición, el archivo no es obligatorio
        this.incidenteForm.get('imagen')?.clearValidators();
        this.incidenteForm.get('imagen')?.updateValueAndValidity();
        this.obtenerIncidente();
      }
    });
  }

  initForm() {
    this.incidenteForm = this.fb.group({
      idInstalacion: [null, Validators.required],
      idOperador: [null, Validators.required],
      incidente: [null],
      imagen: [null, Validators.required],
      fhRegistro: [new Date()]
    });
  }

  obtenerInstalaciones() {
    this.mantenimientosService.obtenerInstalaciones().subscribe({
      next: (response: any) => {
        this.listaInstalaciones = Array.isArray(response.data) ? response.data : (Array.isArray(response) ? response : []);
        this.instalacionesCargadas = true;
        this.checkAndFillForm();
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
        this.listaOperadores = Array.isArray(response.data) ? response.data : (Array.isArray(response) ? response : []);
        this.operadoresCargados = true;
        this.checkAndFillForm();
      },
      error: (error) => {
        console.error('Error al obtener operadores:');
        this.operadoresCargados = true;
      }
    });
  }

  obtenerIncidente() {
    if (!this.idIncidente) return;

    this.loading = true;
    this.mantenimientosService.obtenerIncidentePorId(this.idIncidente).subscribe({
      next: (response: any) => {
        let data = response.data || response;

        if (Array.isArray(data) && data.length > 0) {
          data = data[0];
        }

        this.loading = false;

        if (this.todosLosDatosCargados()) {
          this.llenarFormulario(data);
        } else {
          this.datosIncidente = data;
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('Error:');
        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: 'Ocurrió un error al cargar los datos del incidente.',
          confirmText: 'Confirmar',
          backdropClose: false
        });
        this.cancelar();
      }
    });
  }

  checkAndFillForm() {
    if (this.isEditMode && this.datosIncidente && this.todosLosDatosCargados()) {
      this.llenarFormulario(this.datosIncidente);
      this.datosIncidente = null;
    }
  }

  todosLosDatosCargados(): boolean {
    return this.instalacionesCargadas && this.operadoresCargados;
  }

  llenarFormulario(data: any) {
    if (Array.isArray(data) && data.length > 0) {
      data = data[0];
    }

    const idInstalacion = data?.idInstalacion ?? data?.IdInstalacion ?? data?.ID_INSTALACION ?? data?.id_instalacion ?? null;
    const idOperador = data?.idOperador ?? data?.IdOperador ?? data?.ID_OPERADOR ?? data?.id_operador ?? null;
    const incidente = data?.incidente ?? data?.Incidente ?? data?.descripcionIncidente ?? data?.DescripcionIncidente ?? '';
    const fhRegistro = data?.fhRegistro ?? data?.FhRegistro ?? data?.FH_REGISTRO ?? new Date();
    const imagenUrl = data?.imagen ?? data?.Imagen ?? data?.captura ?? data?.Captura ?? null;

    const formValues: any = {
      idInstalacion: idInstalacion != null && idInstalacion !== undefined ? Number(idInstalacion) : null,
      idOperador: idOperador != null && idOperador !== undefined ? Number(idOperador) : null,
      incidente: incidente || '',
      fhRegistro: fhRegistro ? new Date(fhRegistro) : new Date()
    };

    Object.keys(formValues).forEach(key => {
      const control = this.incidenteForm.get(key);
      if (control) {
        control.setValue(formValues[key], { emitEvent: false });
      }
    });

    if (imagenUrl && typeof imagenUrl === 'string') {
      this.imagenPreviewUrl = imagenUrl;
      this.imagenFileName = 'Imagen del incidente existente';
      // En modo edición, el archivo no es obligatorio si ya existe uno
      this.incidenteForm.get('imagen')?.clearValidators();
      this.incidenteForm.get('imagen')?.updateValueAndValidity();
    }

    setTimeout(() => {
      this.incidenteForm.updateValueAndValidity({ emitEvent: false });
    }, 100);
  }

  openImagenFilePicker() {
    if (this.imagenInput?.nativeElement) {
      this.imagenInput.nativeElement.click();
    }
  }

  onImagenFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleImagenFile(input.files[0]);
    }
  }

  handleImagenFile(file: File) {
    if (!file.type.startsWith('image/')) {
      this.alerts.open({
        type: 'error',
        title: 'Error',
        message: 'El archivo debe ser una imagen.',
        confirmText: 'Entendido'
      });
      return;
    }

    this.imagenFile = file;
    this.imagenFileName = file.name;
    this.incidenteForm.patchValue({ imagen: file });

    const reader = new FileReader();
    reader.onload = (e) => {
      this.imagenPreviewUrl = e.target?.result || null;
    };
    reader.readAsDataURL(file);
  }

  clearImagenFile(event: Event) {
    event.stopPropagation();
    this.imagenFile = null;
    this.imagenFileName = '';
    this.imagenPreviewUrl = null;
    this.incidenteForm.patchValue({ imagen: null });
    if (this.imagenInput?.nativeElement) {
      this.imagenInput.nativeElement.value = '';
    }
    // Si estamos en modo edición y no hay archivo, el campo vuelve a ser requerido
    if (this.isEditMode && !this.imagenPreviewUrl) {
      this.incidenteForm.get('imagen')?.setValidators(Validators.required);
      this.incidenteForm.get('imagen')?.updateValueAndValidity();
    }
  }

  onImagenDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.imagenDragging = true;
  }

  onImagenDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.imagenDragging = false;
  }

  onImagenDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.imagenDragging = false;

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      this.handleImagenFile(file);
    }
  }

  async submit() {
    this.showRequiredMsgs = true;

    if (this.incidenteForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;

      const etiquetas: Record<string, string> = {
        idInstalacion: 'Instalación',
        idOperador: 'Operador',
        imagen: 'Imagen',
        incidente: 'Descripción del Incidente',
        fhRegistro: 'Fecha y Hora de Registro'
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.incidenteForm.controls).forEach((key) => {
        const control = this.incidenteForm.get(key);
        if (control?.invalid && control.errors?.['required']) {
          camposFaltantes.push(etiquetas[key] || key);
        }
      });

      const lista = camposFaltantes.map((campo, i) => `
        <div style="padding:8px 12px; border-left:4px solid #d9534f; background:#caa8a8; text-align:center; margin-bottom:8px; border-radius:4px;">
          <strong style="color:#b02a37;">${i + 1}. ${campo}</strong>
        </div>
      `).join('');

      await this.alerts.open({
        type: 'warning',
        title: '¡Ops!',
        message: `
          <p style="text-align:center; font-size:15px; margin-bottom:16px;">
            Hay campos obligatorios sin completar.
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

    const formValue = this.incidenteForm.getRawValue();
    const formData = new FormData();

    formData.append('idInstalacion', String(formValue.idInstalacion));
    formData.append('idOperador', String(formValue.idOperador));
    
    if (formValue.incidente) {
      formData.append('incidente', formValue.incidente);
    }

    if (formValue.imagen && formValue.imagen instanceof File) {
      formData.append('imagen', formValue.imagen);
    }

    if (formValue.fhRegistro) {
      formData.append('fhRegistro', this.formatDate(formValue.fhRegistro));
    }

    const request = this.isEditMode
      ? this.mantenimientosService.actualizarIncidente(this.idIncidente!, formData)
      : this.mantenimientosService.agregarIncidente(formData);

    request.subscribe({
      next: async (response: any) => {
        this.loading = false;
        this.submitButton = 'Guardar';

        await this.alerts.open({
          type: 'success',
          title: '¡Éxito!',
          message: `El incidente se ha ${this.isEditMode ? 'actualizado' : 'registrado'} correctamente.`,
          confirmText: 'Aceptar'
        });

        this.route.navigate(['/administracion/incidentes']);
      },
      error: async (error) => {
        this.loading = false;
        this.submitButton = 'Guardar';

        const errorMessage = error?.error?.message || error?.message || `Error al ${this.isEditMode ? 'actualizar' : 'registrar'} el incidente.`;

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
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`;
  }

  cancelar() {
    this.route.navigate(['/administracion/incidentes']);
  }
}
