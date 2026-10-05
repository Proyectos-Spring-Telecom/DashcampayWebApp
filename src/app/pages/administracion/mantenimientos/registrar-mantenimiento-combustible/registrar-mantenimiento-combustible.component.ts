import { Component, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  UntypedFormControl,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { MantenimientosService } from 'src/app/pages/services/mantenimientos.service';

@Component({
  selector: 'vex-registrar-mantenimiento-combustible',
  templateUrl: './registrar-mantenimiento-combustible.component.html',
  styleUrl: './registrar-mantenimiento-combustible.component.scss',
  animations: [fadeInRight400ms]
})
export class RegistrarMantenimientoCombustibleComponent implements OnInit {
  layoutCtrl = new UntypedFormControl('fullwidth');
  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public mantenimientoForm!: FormGroup;
  public title = 'Registrar Mantenimiento de Combustible';
  public showRequiredMsgs: boolean = false;
  public idMantenimiento: number | null = null;
  public isEditMode: boolean = false;

  // Listas para selects
  public listaInstalaciones: any[] = [];
  public listaTiposCombustible: any[] = [];
  public listaOperadores: any[] = [];
  public instalacionesCargadas: boolean = false;
  public tiposCombustibleCargados: boolean = false;
  public operadoresCargados: boolean = false;
  public datosMantenimiento: any = null;

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
        this.title = 'Actualizar Mantenimiento de Combustible';
        this.obtenerInstalaciones();
        this.obtenerTiposCombustible();
        this.obtenerOperadores();
        this.obtenerMantenimiento();
      } else {
        this.obtenerInstalaciones();
        this.obtenerTiposCombustible();
        this.obtenerOperadores();
      }
    });
  }

  initForm() {
    this.mantenimientoForm = this.fb.group({
      idTipoCombustible: [null, Validators.required],
      cantidadCombustible: [null, [Validators.required, Validators.min(0)]],
      precioCombustible: [null, [Validators.required, Validators.min(0)]],
      idInstalacion: [null, Validators.required],
      estatus: [1, Validators.required],
      fechaHora: [new Date(), [Validators.required, this.fechaValidaValidator]],
      kilometraje: [null, [Validators.required, Validators.min(0)]],
      idOperador: [null, Validators.required]
    });
  }

  private toDateValue(value: unknown): Date | null {
    if (value == null || value === '') return null;
    const d = value instanceof Date ? value : new Date(value as string | number);
    return isNaN(d.getTime()) ? null : d;
  }

  private fechaValidaValidator = (control: AbstractControl): ValidationErrors | null => {
    if (control.value == null || control.value === '') return null;
    return this.toDateValue(control.value) ? null : { fechaInvalida: true };
  };

  obtenerInstalaciones() {
    this.mantenimientosService.obtenerInstalaciones().subscribe({
      next: (response: any) => {
        this.listaInstalaciones = (response.data || response || []).map((item: any) => ({
          ...item,
          id: Number(item?.id ?? item?.Id ?? item?.ID)
        }));
        this.instalacionesCargadas = true;
        
        // Si hay datos de mantenimiento esperando, intentar llenar el formulario
        if (this.datosMantenimiento && this.todosLosDatosCargados()) {
          this.llenarFormulario(this.datosMantenimiento);
          this.datosMantenimiento = null;
        }
      },
      error: (error: unknown) => {
        console.error('Error al obtener instalaciones:');
        this.instalacionesCargadas = true;
      }
    });
  }

  obtenerTiposCombustible() {
    this.mantenimientosService.obtenerTiposCombustible().subscribe({
      next: (response: any) => {
        this.listaTiposCombustible = (response.data || response || []).map((item: any) => ({
          ...item,
          id: Number(item?.id ?? item?.Id ?? item?.ID)
        }));
        this.tiposCombustibleCargados = true;
        
        // Si hay datos de mantenimiento esperando, intentar llenar el formulario
        if (this.datosMantenimiento && this.todosLosDatosCargados()) {
          this.llenarFormulario(this.datosMantenimiento);
          this.datosMantenimiento = null;
        }
      },
      error: (error: unknown) => {
        console.error('Error al obtener tipos de combustible:');
        this.tiposCombustibleCargados = true;
      }
    });
  }

  obtenerOperadores() {
    this.mantenimientosService.obtenerOperadores().subscribe({
      next: (response: any) => {
        this.listaOperadores = (response.data || response || []).map((item: any) => ({
          ...item,
          id: Number(item?.id ?? item?.Id ?? item?.ID)
        }));
        this.operadoresCargados = true;
        
        // Si hay datos de mantenimiento esperando, intentar llenar el formulario
        if (this.datosMantenimiento && this.todosLosDatosCargados()) {
          this.llenarFormulario(this.datosMantenimiento);
          this.datosMantenimiento = null;
        }
      },
      error: (error: unknown) => {
        console.error('Error al obtener operadores:');
        this.operadoresCargados = true;
      }
    });
  }

  todosLosDatosCargados(): boolean {
    return this.instalacionesCargadas && this.tiposCombustibleCargados && this.operadoresCargados;
  }

  obtenerMantenimiento() {
    if (!this.idMantenimiento) return;

    this.loading = true;
    this.mantenimientosService.obtenerMantenimientoCombustiblePorId(this.idMantenimiento).subscribe({
      next: (response: any) => {
        const raw = response?.data ?? response;
        const data = Array.isArray(raw)
          ? (raw.find((x: any) => Number(x?.id) === Number(this.idMantenimiento)) ?? raw[0])
          : raw;

        if (!data) {
          this.loading = false;
          this.alerts.open({
            type: 'warning',
            title: '¡Ops!',
            message: 'No se encontraron datos del mantenimiento.',
            confirmText: 'Confirmar',
            backdropClose: false
          });
          return;
        }

        if (this.todosLosDatosCargados()) {
          this.llenarFormulario(data);
          this.loading = false;
        } else {
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
    if (Array.isArray(data) && data.length > 0) {
      data = data.find((x: any) => Number(x?.id) === Number(this.idMantenimiento)) ?? data[0];
    }

    const idTipoCombustible =
      data?.idTipoCombustible ??
      data?.IdTipoCombustible ??
      data?.tipoCombustible?.id ??
      data?.TipoCombustible?.id ??
      null;
    const cantidadCombustible = data?.cantidadCombustible ?? data?.CantidadCombustible ?? null;
    const precioCombustible = data?.precioCombustible ?? data?.PrecioCombustible ?? null;
    const idInstalacion =
      data?.idInstalacion ??
      data?.IdInstalacion ??
      data?.instalacion?.id ??
      data?.Instalacion?.id ??
      null;
    const estatus = data?.estatus ?? data?.Estatus ?? 1;
    const fechaHora = data?.fechaHora ?? data?.FechaHora ?? null;
    const kilometraje = data?.kilometraje ?? data?.Kilometraje ?? null;
    const idOperador =
      data?.idOperador ??
      data?.IdOperador ??
      data?.operador?.id ??
      data?.Operador?.id ??
      null;

    const formValues: any = {
      idTipoCombustible: idTipoCombustible != null ? Number(idTipoCombustible) : null,
      cantidadCombustible: cantidadCombustible != null ? Number(cantidadCombustible) : null,
      precioCombustible: precioCombustible != null ? Number(precioCombustible) : null,
      idInstalacion: idInstalacion != null ? Number(idInstalacion) : null,
      estatus: estatus != null ? Number(estatus) : 1,
      fechaHora: this.toDateValue(fechaHora) ?? new Date(),
      kilometraje: kilometraje != null ? Number(kilometraje) : null,
      idOperador: idOperador != null ? Number(idOperador) : null
    };

    Object.keys(formValues).forEach((key) => {
      const control = this.mantenimientoForm.get(key);
      if (control) {
        control.setValue(formValues[key], { emitEvent: false });
      }
    });

    this.mantenimientoForm.updateValueAndValidity({ emitEvent: false });
  }

  async submit() {
    this.showRequiredMsgs = true;

    if (this.mantenimientoForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;

      const etiquetas: Record<string, string> = {
        idTipoCombustible: 'Tipo de Combustible',
        cantidadCombustible: 'Cantidad de Combustible',
        precioCombustible: 'Precio de Combustible',
        idInstalacion: 'Instalación',
        estatus: 'Estatus',
        fechaHora: 'Fecha y Hora',
        kilometraje: 'Kilometraje',
        idOperador: 'Operador'
      };

      const mensajes: string[] = [];
      Object.keys(this.mantenimientoForm.controls).forEach((key) => {
        const control = this.mantenimientoForm.get(key);
        if (!control?.invalid || !control.errors) return;
        const label = etiquetas[key] || key;
        if (control.errors['required']) {
          mensajes.push(label);
        } else if (control.errors['fechaInvalida']) {
          mensajes.push(`${label}: fecha no válida`);
        } else if (control.errors['min']) {
          mensajes.push(`${label}: no puede ser negativo`);
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
    const fechaHora = new Date(formValue.fechaHora);
    
    const payload = {
      idTipoCombustible: Number(formValue.idTipoCombustible),
      cantidadCombustible: Number(formValue.cantidadCombustible),
      precioCombustible: Number(formValue.precioCombustible),
      idInstalacion: Number(formValue.idInstalacion),
      estatus: Number(formValue.estatus || 1),
      fechaHora: fechaHora.toISOString(),
      kilometraje: Number(formValue.kilometraje),
      idOperador: Number(formValue.idOperador)
    };

    const request = this.isEditMode && this.idMantenimiento
      ? this.mantenimientosService.actualizarMantenimientoCombustible(this.idMantenimiento, payload)
      : this.mantenimientosService.agregarMantenimientoCombustible(payload);

    request.subscribe({
      next: () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: this.isEditMode
            ? 'Se actualizó el mantenimiento de combustible de manera exitosa.'
            : 'Se registró el mantenimiento de combustible de manera exitosa.',
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
            ? 'Ocurrió un error al actualizar el mantenimiento de combustible.'
            : 'Ocurrió un error al registrar el mantenimiento de combustible.',
          confirmText: 'Confirmar',
          backdropClose: false
        });
        console.error('Error:');
      }
    });
  }

  regresar() {
    this.route.navigateByUrl('/administracion/mantenimientos/mantenimiento-combustible');
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
