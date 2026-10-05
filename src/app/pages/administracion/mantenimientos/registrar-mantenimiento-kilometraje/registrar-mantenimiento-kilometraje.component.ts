import { Component, OnInit } from '@angular/core';
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
  selector: 'vex-registrar-mantenimiento-kilometraje',
  templateUrl: './registrar-mantenimiento-kilometraje.component.html',
  styleUrl: './registrar-mantenimiento-kilometraje.component.scss',
  animations: [fadeInRight400ms]
})
export class RegistrarMantenimientoKilometrajeComponent implements OnInit {
  layoutCtrl = new UntypedFormControl('fullwidth');
  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public mantenimientoForm!: FormGroup;
  public title = 'Registrar Mantenimiento de Kilometraje';
  public showRequiredMsgs: boolean = false;
  public idMantenimiento: number | null = null;
  public isEditMode: boolean = false;

  // Listas para selects
  public listaInstalaciones: any[] = [];
  public instalacionesCargadas: boolean = false;
  public datosMantenimiento: any = null;
  public listaMeses: any[] = [
    { id: 1, nombre: 'Enero' },
    { id: 2, nombre: 'Febrero' },
    { id: 3, nombre: 'Marzo' },
    { id: 4, nombre: 'Abril' },
    { id: 5, nombre: 'Mayo' },
    { id: 6, nombre: 'Junio' },
    { id: 7, nombre: 'Julio' },
    { id: 8, nombre: 'Agosto' },
    { id: 9, nombre: 'Septiembre' },
    { id: 10, nombre: 'Octubre' },
    { id: 11, nombre: 'Noviembre' },
    { id: 12, nombre: 'Diciembre' }
  ];

  constructor(
    private route: Router,
    private fb: FormBuilder,
    private mantenimientosService: MantenimientosService,
    private activatedRoute: ActivatedRoute,
    private alerts: AlertsService
  ) {}

  ngOnInit(): void {
    this.initForm();
    
    this.activatedRoute.params.subscribe((params) => {
      this.idMantenimiento = params['id'] ? Number(params['id']) : null;
      if (this.idMantenimiento) {
        this.isEditMode = true;
        this.title = 'Actualizar Mantenimiento de Kilometraje';
        // Cargar instalaciones y mantenimiento en paralelo
        this.obtenerInstalaciones();
        this.obtenerMantenimiento();
      } else {
        this.obtenerInstalaciones();
      }
    });
  }

  initForm() {
    const currentYear = new Date().getFullYear();
    this.mantenimientoForm = this.fb.group({
      idInstalacion: [null, Validators.required],
      kmInicial: [null, Validators.required],
      kmDeseado: [null, Validators.required],
      periodo: [null, Validators.required],
      anio: [currentYear, Validators.required]
    });
  }

  obtenerInstalaciones() {
    this.mantenimientosService.obtenerInstalaciones().subscribe({
      next: (response: any) => {
        this.listaInstalaciones = (response.data || response || []).map((item: any) => ({
          ...item,
          id: Number(item?.id ?? item?.Id ?? item?.ID)
        }));
        this.instalacionesCargadas = true;
        
        // Si hay datos de mantenimiento esperando, llenar el formulario ahora
        if (this.datosMantenimiento) {
          this.llenarFormulario(this.datosMantenimiento);
          this.datosMantenimiento = null;
        }
      },
      error: (error: unknown) => {
        console.error('Error al obtener instalaciones:');
        this.instalacionesCargadas = true; // Marcar como cargado incluso con error
      }
    });
  }

  obtenerMantenimiento() {
    if (!this.idMantenimiento) return;
    
    this.loading = true;
    this.mantenimientosService.obtenerMantenimientoKilometrajePorId(this.idMantenimiento).subscribe({
      next: (response: any) => {
        const data = response.data || response;
        
        // Si las instalaciones ya están cargadas, llenar el formulario directamente
        if (this.instalacionesCargadas) {
          this.llenarFormulario(data);
          this.loading = false;
        } else {
          // Guardar los datos para llenar el formulario cuando las instalaciones estén listas
          this.datosMantenimiento = data;
          this.loading = false;
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('Error:');
        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: 'Ocurrió un error al cargar los datos del mantenimiento.',
          confirmText: 'Confirmar',
          backdropClose: false
        });
        this.regresar();
      }
    });
  }

  llenarFormulario(data: any) {
    // Si data es un array, tomar el primer elemento
    if (Array.isArray(data) && data.length > 0) {
      data = data[0];
    }
    
    // Normalizar los datos del API (manejar variaciones de mayúsculas/minúsculas)
    const idInstalacion = data?.idInstalacion ?? data?.IdInstalacion ?? data?.ID_INSTALACION ?? data?.id_instalacion ?? null;
    const kmInicial = data?.kmInicial ?? data?.KmInicial ?? data?.KM_INICIAL ?? data?.km_inicial ?? null;
    const kmDeseado = data?.kmDeseado ?? data?.KmDeseado ?? data?.KM_DESEADO ?? data?.km_deseado ?? null;
    const periodo = data?.periodo ?? data?.Periodo ?? data?.PERIODO ?? null;
    const anio = data?.anio ?? data?.Anio ?? data?.Año ?? data?.AÑO ?? data?.ANIO ?? data?.anio ?? null;
    
    // Preparar los valores para el formulario
    const formValues: any = {
      idInstalacion: idInstalacion != null && idInstalacion !== undefined ? Number(idInstalacion) : null,
      kmInicial: kmInicial != null && kmInicial !== undefined ? Number(kmInicial) : null,
      kmDeseado: kmDeseado != null && kmDeseado !== undefined ? Number(kmDeseado) : null,
      periodo: periodo != null && periodo !== undefined ? Number(periodo) : null,
      anio: anio != null && anio !== undefined ? Number(anio) : null
    };
    
    // Llenar el formulario con los datos normalizados usando setValue en cada control
    Object.keys(formValues).forEach(key => {
      const control = this.mantenimientoForm.get(key);
      if (control) {
        control.setValue(formValues[key], { emitEvent: false });
      }
    });
    
    // Actualizar validez de todos los controles
    this.mantenimientoForm.updateValueAndValidity({ emitEvent: false });
  }

  async submit() {
    this.showRequiredMsgs = true;

    if (this.mantenimientoForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;

      const etiquetas: Record<string, string> = {
        idInstalacion: 'Instalación',
        kmInicial: 'Kilometraje Inicial',
        kmDeseado: 'Kilometraje Deseado',
        periodo: 'Período',
        anio: 'Año'
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.mantenimientoForm.controls).forEach((key) => {
        const control = this.mantenimientoForm.get(key);
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

    const formValue = this.mantenimientoForm.getRawValue();
    const payload = {
      idInstalacion: Number(formValue.idInstalacion),
      kmInicial: Number(formValue.kmInicial),
      kmDeseado: Number(formValue.kmDeseado),
      periodo: Number(formValue.periodo),
      anio: Number(formValue.anio)
    };

    const request = this.isEditMode && this.idMantenimiento
      ? this.mantenimientosService.actualizarMantenimientoKilometraje(this.idMantenimiento, payload)
      : this.mantenimientosService.agregarMantenimientoKilometraje(payload);

    request.subscribe({
      next: () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: this.isEditMode
            ? 'Se actualizó el mantenimiento de kilometraje de manera exitosa.'
            : 'Se registró el mantenimiento de kilometraje de manera exitosa.',
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
            ? 'Ocurrió un error al actualizar el mantenimiento de kilometraje.'
            : 'Ocurrió un error al registrar el mantenimiento de kilometraje.',
          confirmText: 'Confirmar',
          backdropClose: false
        });
        console.error('Error:');
      }
    });
  }

  regresar() {
    this.route.navigateByUrl('/administracion/mantenimientos/mantenimiento-kilometraje');
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
