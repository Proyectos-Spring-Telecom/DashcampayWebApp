import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, UntypedFormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { VexPageLayoutComponent } from '@vex/components/vex-page-layout/vex-page-layout.component';
import { VexPageLayoutContentDirective } from '@vex/components/vex-page-layout/vex-page-layout-content.directive';
import { TiposPasajeroService } from '../../../services/tipos-pasajero.service';
import { ClientesService } from '../../../services/clientes.service';
import { AlertsService } from '../../../pages/modal/alerts.service';
import { AuthenticationService } from 'src/app/core/services/auth.service';
import {
  bloquearCaracteresEspecialesNombre,
  NOMBRE_SIN_ESPECIALES_REGEX,
  onPasteNombreSinEspeciales
} from 'src/app/core/validators/nombre-sin-especiales';

@Component({
  selector: 'vex-registrar-tipo-pasajero',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    VexPageLayoutComponent,
    VexPageLayoutContentDirective,
    RouterModule
  ],
  templateUrl: './registrar-tipo-pasajero.component.html',
  styleUrl: './registrar-tipo-pasajero.component.scss',
  animations: [fadeInRight400ms]
})
export class RegistrarTipoPasajeroComponent implements OnInit {
  layoutCtrl = new UntypedFormControl('fullwidth');
  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public tipoPasajeroForm!: FormGroup;
  public idTipoPasajero!: number;
  public title = 'Registrar Tipo de Pasajero';
  public listaTiposDescuento: any[] = [];
  public listaClientes: any[] = [];
  public loadingDependientes: boolean = false;

  public idClienteUser!: number;
  public idRolUser!: number;

  constructor(
    private fb: FormBuilder,
    private tiposPasajeroService: TiposPasajeroService,
    private clientesService: ClientesService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private alerts: AlertsService,
    private authService: AuthenticationService
  ) {
    const user = this.authService.getUser();
    this.idClienteUser = Number(user?.idCliente);
    this.idRolUser = Number(user?.rol?.id);
  }

  ngOnInit(): void {
    this.initForm();
    this.obtenerTiposDescuento();
    this.obtenerClientes();
    this.activatedRoute.params.subscribe((params) => {
      this.idTipoPasajero = params['id'];
      if (this.idTipoPasajero) {
        this.title = 'Actualizar Tipo de Pasajero';
        this.obtenerTipoPasajero();
      }
    });
  }

  initForm(): void {
    this.tipoPasajeroForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(50), Validators.pattern(NOMBRE_SIN_ESPECIALES_REGEX)]],
      idCatTipoDescuento: [null, Validators.required],
      cantidad: [null, [Validators.min(0)]],
      idCliente: [null, Validators.required]
    });

    this.tipoPasajeroForm.get('idCatTipoDescuento')?.valueChanges.subscribe(() => {
      this.actualizarValidadoresCantidad();
    });
  }

  get esTipoPorcentaje(): boolean {
    const id = Number(this.tipoPasajeroForm?.get('idCatTipoDescuento')?.value);
    if (!Number.isFinite(id)) return false;
    const tipo = this.listaTiposDescuento.find(
      (t: any) => Number(t?.idCatTipoDescuento ?? t?.id) === id
    );
    const nombre = String(
      tipo?.nombreCatTipoDescuento ?? tipo?.nombre ?? tipo?.nombreTipoDescuento ?? ''
    ).toLowerCase();
    return nombre.includes('porcentaje') || nombre.includes('%');
  }

  private actualizarValidadoresCantidad(): void {
    const cantidadCtrl = this.tipoPasajeroForm.get('cantidad');
    if (!cantidadCtrl) return;

    const validators = [Validators.min(0)];
    if (this.esTipoPorcentaje) {
      validators.push(Validators.max(100));
    }
    cantidadCtrl.setValidators(validators);
    cantidadCtrl.updateValueAndValidity({ emitEvent: false });
  }

  obtenerTiposDescuento(): void {
    this.loadingDependientes = true;
    this.tiposPasajeroService.obtenerTiposDescuento().subscribe({
      next: (response) => {
        this.listaTiposDescuento = response.data || [];
        this.loadingDependientes = false;
        this.actualizarValidadoresCantidad();
      },
      error: (err) => {
        console.error('Error al obtener tipos de descuento:');
        this.loadingDependientes = false;
      }
    });
  }

  obtenerClientes(): void {
    this.loadingDependientes = true;
    this.clientesService.obtenerClientes().subscribe({
      next: (response) => {
        this.listaClientes = response.data || [];
        this.loadingDependientes = false;
        
        // Si el rol del usuario es 4 o mayor, establecer su idCliente y deshabilitar el campo
        if (this.idRolUser >= 4 && this.idClienteUser) {
          this.tipoPasajeroForm.get('idCliente')?.setValue(this.idClienteUser, { emitEvent: false });
          this.tipoPasajeroForm.get('idCliente')?.disable({ onlySelf: true });
        }
      },
      error: (err) => {
        console.error('Error al obtener clientes:');
        this.loadingDependientes = false;
      }
    });
  }

  obtenerTipoPasajero(): void {
    this.loading = true;
    this.tiposPasajeroService.obtenerTipoPasajero(this.idTipoPasajero).subscribe({
      next: (response) => {
        // La respuesta puede venir como array directo o dentro de response.data
        let dataArray: any[] = [];
        if (Array.isArray(response)) {
          dataArray = response;
        } else if (Array.isArray(response?.data)) {
          dataArray = response.data;
        } else if (response?.data) {
          dataArray = [response.data];
        }
        
        const data = dataArray.length > 0 ? dataArray[0] : null;
        
        if (data) {
          // Si el rol es >= 4, usar el idCliente del usuario, sino usar el de los datos
          const idClienteValue = (this.idRolUser >= 4 && this.idClienteUser) 
            ? this.idClienteUser 
            : (data.idCliente ? Number(data.idCliente) : '');
          
          // Convertir los valores string a número para que coincidan con los valores del formulario
          const idCatTipoDescuentoValue = data.idCatTipoDescuento ? Number(data.idCatTipoDescuento) : '';
          
          this.tipoPasajeroForm.patchValue({
            nombre: data.nombre || '',
            idCatTipoDescuento: idCatTipoDescuentoValue,
            cantidad: data.cantidad != null ? Number(data.cantidad) : null,
            idCliente: idClienteValue
          });
          this.actualizarValidadoresCantidad();
          
          // Si el rol es >= 4, deshabilitar el campo
          if (this.idRolUser >= 4) {
            this.tipoPasajeroForm.get('idCliente')?.disable({ onlySelf: true });
          }
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al obtener tipo de pasajero:');
        this.loading = false;
        this.alerts.open({
          type: 'error',
          title: '¡Error!',
          message: 'Error al cargar los datos del tipo de pasajero',
          confirmText: 'Aceptar',
          backdropClose: false
        });
      }
    });
  }

  async submit(): Promise<void> {
    this.submitButton = 'Cargando...';
    this.loading = true;

    if (this.tipoPasajeroForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;
      this.tipoPasajeroForm.markAllAsTouched();

      const etiquetas: any = {
        nombre: 'Nombre',
        idCatTipoDescuento: 'Tipo de Descuento',
        idCliente: 'Cliente',
        cantidad: 'Cantidad'
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.tipoPasajeroForm.controls).forEach(key => {
        const control = this.tipoPasajeroForm.get(key);
        if (control?.errors?.['required']) {
          camposFaltantes.push(etiquetas[key] || key);
        }
        if (key === 'nombre' && control?.errors?.['maxlength']) {
          camposFaltantes.push('Nombre: máximo 50 caracteres');
        }
        if (key === 'nombre' && control?.errors?.['pattern']) {
          camposFaltantes.push('Nombre: no permite caracteres especiales');
        }
        if (key === 'cantidad' && control?.errors?.['min']) {
          camposFaltantes.push('Cantidad no puede ser negativa');
        }
        if (key === 'cantidad' && control?.errors?.['max']) {
          camposFaltantes.push('Cantidad no puede ser mayor a 100 cuando el descuento es porcentaje');
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
        title: '¡Ops!',
        message: `
          <p style="text-align: center; font-size: 15px; margin-bottom: 16px; color: white">
            Hay campos que requieren atención.<br>
          </p>
          <div style="max-height: 350px; overflow-y: auto;">${lista}</div>
        `,
        confirmText: 'Entendido',
        backdropClose: false
      });
      return;
    }

    if (this.idTipoPasajero) {
      this.actualizar();
    } else {
      this.agregar();
    }
  }

  agregar(): void {
    const payload = this.tipoPasajeroForm.getRawValue();
    
    this.tiposPasajeroService.agregarTipoPasajero(payload).subscribe({
      next: () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'Se agregó un nuevo tipo de pasajero de manera exitosa.',
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
          message: this.getErrorMessage(error),
          confirmText: 'Confirmar',
          backdropClose: false
        });
      }
    });
  }

  actualizar(): void {
    const payload = this.tipoPasajeroForm.getRawValue();
    
    this.tiposPasajeroService.actualizarTipoPasajero(this.idTipoPasajero, payload).subscribe({
      next: () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'Los datos del tipo de pasajero se actualizaron correctamente.',
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
          message: this.getErrorMessage(error),
          confirmText: 'Confirmar',
          backdropClose: false
        });
      }
    });
  }

  private getErrorMessage(err: any): string {
    const body = err?.error ?? err;

    if (typeof body === 'string' && body.trim()) {
      return body;
    }

    if (typeof body?.message === 'string' && body.message.trim()) {
      return body.message;
    }

    if (Array.isArray(body?.message)) {
      return body.message.filter(Boolean).join('\n');
    }

    if (body?.message && typeof body.message === 'object') {
      const lines: string[] = [];
      for (const key of Object.keys(body.message)) {
        const val = body.message[key];
        if (Array.isArray(val)) lines.push(val.join(', '));
        else if (typeof val === 'string') lines.push(val);
      }
      if (lines.length) return lines.join('\n');
    }

    if (body?.errors) {
      const e = body.errors;
      if (Array.isArray(e)) return e.filter(Boolean).join('\n');
      if (typeof e === 'object') {
        const lines: string[] = [];
        for (const key of Object.keys(e)) {
          const val = e[key];
          if (Array.isArray(val)) lines.push(val.join(', '));
          else if (typeof val === 'string') lines.push(val);
        }
        if (lines.length) return lines.join('\n');
      }
    }

    if (typeof err?.message === 'string' && err.message.trim() && !err.message.startsWith('Http failure')) {
      return err.message;
    }

    return 'Ocurrió un error al procesar el tipo de pasajero.';
  }

  bloquearNegativo(event: KeyboardEvent): void {
    if (event.key === '-' || event.key === 'e' || event.key === 'E' || event.key === '+') {
      event.preventDefault();
    }
  }

  onPasteNombre(event: ClipboardEvent): void {
    onPasteNombreSinEspeciales(event, this.tipoPasajeroForm.get('nombre'));
  }

  bloquearCaracteresEspecialesNombre = bloquearCaracteresEspecialesNombre;

  regresar(): void {
    this.router.navigateByUrl('/administracion/tipos-pasajero');
  }
}
