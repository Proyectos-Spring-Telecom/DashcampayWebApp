import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit, OnDestroy, NgZone } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { NetpayService } from '../../../services/netpay.service';
import { environment } from '../../../../../environments/environment';

declare const NetPay: any;

export interface NetpayDialogData {
  monto?: number;
  monederoSerie: string;
  customerId?: string;
  direccionesDisponibles?: any[];
}

export interface NetpayDialogResult {
  token: string;
  deviceFingerPrint: string;
  deviceInformation: any;
  referenceId?: string;
  cvv?: string;
  clienteInfo?: {
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    email: string;
    telefono: string;
    idDireccion?: number | null;
    direccion?: {
      ciudad: string;
      pais: string;
      CP: string;
      estado: string;
      calle: string;
      calleEsquina: string;
      colonia?: string;
    };
  };
}

@Component({
  selector: 'vex-netpay-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  template: `
    <h2 mat-dialog-title class="d-flex align-items-center justify-content-between">
      <span>
        <mat-icon class="me-2">credit_card</mat-icon>
        Agregar Tarjeta
      </span>
      <button mat-icon-button (click)="cancelar()" type="button" aria-label="Cerrar">
        <mat-icon>close</mat-icon>
      </button>
    </h2>

    <mat-dialog-content>
      <div class="resumen-pago mb-4 p-3 bg-light rounded">
        <div class="d-flex justify-content-between align-items-center mb-2" *ngIf="data.monto && data.monto > 0">
          <span><strong>Monto a pagar:</strong></span>
          <span class="h5 mb-0 text-primary">{{ data.monto | currency:'MXN':'symbol':'1.2-2' }}</span>
        </div>
        <div class="d-flex justify-content-between align-items-center mb-2" *ngIf="!data.monto || data.monto <= 0">
          <span><strong>Monto a pagar:</strong></span>
          <span class="h6 mb-0 text-muted">No se ha seleccionado un monto</span>
        </div>
        <div class="d-flex justify-content-between align-items-center">
          <span><strong>Monedero:</strong></span>
          <span>{{ data.monederoSerie }}</span>
        </div>
      </div>

      <form [formGroup]="cardForm" (ngSubmit)="tokenizarTarjeta()" class="card-form">
        <!-- Sección: Datos de la Tarjeta -->
        <h5 class="section-title">Datos de la Tarjeta</h5>
        
        <mat-form-field appearance="outline" class="w-100 mb-3">
          <mat-label>Número de Tarjeta</mat-label>
          <input 
            matInput 
            formControlName="cardNumber"
            placeholder="0000 0000 0000 0000"
            maxlength="19"
            (input)="formatCardNumber($event)"
            autocomplete="cc-number"
          />
          <mat-icon matPrefix>credit_card</mat-icon>
          <mat-error *ngIf="cardForm.get('cardNumber')?.hasError('required')">
            El número de tarjeta es requerido
          </mat-error>
          <mat-error *ngIf="cardForm.get('cardNumber')?.hasError('invalid')">
            Número de tarjeta inválido
          </mat-error>
        </mat-form-field>

        <div class="row">
          <div class="col-6">
            <mat-form-field appearance="outline" class="w-100 mb-3">
              <mat-label>Mes</mat-label>
              <input 
                matInput 
                formControlName="expMonth"
                placeholder="MM"
                maxlength="2"
                (input)="formatMonth($event)"
                autocomplete="cc-exp-month"
              />
              <mat-error *ngIf="cardForm.get('expMonth')?.hasError('required')">
                Requerido
              </mat-error>
              <mat-error *ngIf="cardForm.get('expMonth')?.hasError('pattern')">
                MM inválido
              </mat-error>
            </mat-form-field>
          </div>
          <div class="col-6">
            <mat-form-field appearance="outline" class="w-100 mb-3">
              <mat-label>Año</mat-label>
              <input 
                matInput 
                formControlName="expYear"
                placeholder="AA"
                maxlength="2"
                (input)="formatYear($event)"
                autocomplete="cc-exp-year"
              />
              <mat-error *ngIf="cardForm.get('expYear')?.hasError('required')">
                Requerido
              </mat-error>
              <mat-error *ngIf="cardForm.get('expYear')?.hasError('pattern')">
                AA inválido
              </mat-error>
            </mat-form-field>
          </div>
        </div>

        <mat-form-field appearance="outline" class="w-100 mb-3">
          <mat-label>CVV / CVC</mat-label>
          <input 
            matInput 
            formControlName="cvv"
            placeholder="123"
            maxlength="4"
            type="password"
            (input)="formatCVV($event)"
            autocomplete="cc-csc"
          />
          <mat-icon matPrefix>lock</mat-icon>
          <mat-error *ngIf="cardForm.get('cvv')?.hasError('required')">
            El CVV es requerido
          </mat-error>
          <mat-error *ngIf="cardForm.get('cvv')?.hasError('invalid')">
            CVV inválido
          </mat-error>
        </mat-form-field>

        <!-- Sección: Datos Personales -->
        <h5 class="section-title mt-4">Datos Personales</h5>
        
        <mat-form-field appearance="outline" class="w-100 mb-3">
          <mat-label>Nombre</mat-label>
          <input 
            matInput 
            formControlName="nombre"
            placeholder="Juan"
            autocomplete="given-name"
          />
          <mat-icon matPrefix>person</mat-icon>
          <mat-error *ngIf="cardForm.get('nombre')?.hasError('required')">
            El nombre es requerido
          </mat-error>
          <mat-error *ngIf="cardForm.get('nombre')?.hasError('minlength')">
            Mínimo 2 caracteres
          </mat-error>
        </mat-form-field>

        <div class="row">
          <div class="col-6">
            <mat-form-field appearance="outline" class="w-100 mb-3">
              <mat-label>Apellido Paterno</mat-label>
              <input 
                matInput 
                formControlName="apellidoPaterno"
                placeholder="Pérez"
                autocomplete="family-name"
              />
              <mat-error *ngIf="cardForm.get('apellidoPaterno')?.hasError('required')">
                Requerido
              </mat-error>
            </mat-form-field>
          </div>
          <div class="col-6">
            <mat-form-field appearance="outline" class="w-100 mb-3">
              <mat-label>Apellido Materno</mat-label>
              <input 
                matInput 
                formControlName="apellidoMaterno"
                placeholder="García"
                autocomplete="family-name"
              />
              <mat-error *ngIf="cardForm.get('apellidoMaterno')?.hasError('required')">
                Requerido
              </mat-error>
            </mat-form-field>
          </div>
        </div>

        <mat-form-field appearance="outline" class="w-100 mb-3">
          <mat-label>Correo Electrónico</mat-label>
          <input 
            matInput 
            formControlName="email"
            placeholder="juan.perez@example.com"
            type="email"
            autocomplete="email"
          />
          <mat-icon matPrefix>email</mat-icon>
          <mat-error *ngIf="cardForm.get('email')?.hasError('required')">
            El correo es requerido
          </mat-error>
          <mat-error *ngIf="cardForm.get('email')?.hasError('email')">
            Correo inválido
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-100 mb-3">
          <mat-label>Teléfono (10 dígitos)</mat-label>
          <input 
            matInput 
            formControlName="telefono"
            placeholder="8190034544"
            maxlength="10"
            (input)="formatTelefono($event)"
            autocomplete="tel"
          />
          <mat-icon matPrefix>phone</mat-icon>
          <mat-error *ngIf="cardForm.get('telefono')?.hasError('required')">
            El teléfono es requerido
          </mat-error>
          <mat-error *ngIf="cardForm.get('telefono')?.hasError('pattern')">
            Debe tener 10 dígitos
          </mat-error>
        </mat-form-field>

        <!-- Sección: Dirección -->
        <h5 class="section-title mt-4">Dirección</h5>
        
        <!-- Select de direcciones guardadas -->
        <mat-form-field appearance="outline" class="w-100 mb-3" *ngIf="direccionesDisponibles.length > 0">
          <mat-label>Seleccionar dirección guardada</mat-label>
          <mat-select (selectionChange)="onDireccionSeleccionada($event.value)">
            <mat-option [value]="null">
              <em>Ingresar nueva dirección</em>
            </mat-option>
            <mat-option *ngFor="let dir of direccionesDisponibles" [value]="dir">
              {{ dir.calle }} - {{ dir.calleEsquina }} - {{ dir.ciudad }} - {{ dir.CP }}
            </mat-option>
          </mat-select>
          <mat-icon matPrefix>location_on</mat-icon>
        </mat-form-field>
        
        <!-- Código Postal -->
        <mat-form-field appearance="outline" class="w-100 mb-3">
          <mat-label>Código Postal</mat-label>
          <input 
            matInput 
            formControlName="codigoPostal"
            placeholder="62577"
            maxlength="5"
            (input)="formatCodigoPostal($event)"
            (blur)="onCodigoPostalBlur()"
            autocomplete="postal-code"
          />
          <mat-icon matPrefix>markunread_mailbox</mat-icon>
          <mat-error *ngIf="cardForm.get('codigoPostal')?.hasError('required')">
            Requerido
          </mat-error>
          <mat-error *ngIf="cardForm.get('codigoPostal')?.hasError('pattern')">
            Debe tener 5 dígitos
          </mat-error>
        </mat-form-field>

        <!-- Estado (bloqueado, se llena automáticamente) -->
        <mat-form-field appearance="outline" class="w-100 mb-3">
          <mat-label>Estado</mat-label>
          <input 
            matInput 
            formControlName="estado"
            placeholder="MORELOS"
            autocomplete="address-level1"
            [readonly]="true"
          />
          <mat-icon matPrefix>location_on</mat-icon>
          <mat-error *ngIf="cardForm.get('estado')?.hasError('required')">
            Requerido
          </mat-error>
        </mat-form-field>

        <!-- Ciudad (bloqueado, se llena automáticamente) -->
        <mat-form-field appearance="outline" class="w-100 mb-3">
          <mat-label>Ciudad</mat-label>
          <input 
            matInput 
            formControlName="ciudad"
            placeholder="JIUTEPEC"
            autocomplete="address-level2"
            [readonly]="true"
          />
          <mat-icon matPrefix>location_city</mat-icon>
          <mat-error *ngIf="cardForm.get('ciudad')?.hasError('required')">
            Requerido
          </mat-error>
        </mat-form-field>

        <!-- Colonia (select, se llena con el array de colonias) -->
        <mat-form-field appearance="outline" class="w-100 mb-3">
          <mat-label>Colonia</mat-label>
          <mat-select formControlName="colonia" [disabled]="cargandoColonias || (coloniasDisponibles.length === 0 && cardForm.get('codigoPostal')?.value?.length === 5) || (cardForm.get('colonia')?.disabled ?? false)">
            <mat-option *ngIf="cargandoColonias" [value]="null" disabled>
              Cargando colonias...
            </mat-option>
            <mat-option *ngIf="!cargandoColonias && coloniasDisponibles.length === 0 && cardForm.get('codigoPostal')?.value?.length === 5" [value]="null" disabled>
              No se encontraron colonias
            </mat-option>
            <mat-option *ngIf="!cargandoColonias && coloniasDisponibles.length === 0 && cardForm.get('codigoPostal')?.value?.length !== 5" [value]="null" disabled>
              Ingrese un código postal válido
            </mat-option>
            <mat-option *ngFor="let colonia of coloniasDisponibles" [value]="colonia">
              {{ colonia.nombre }}
            </mat-option>
          </mat-select>
          <mat-icon matPrefix>location_city</mat-icon>
          <mat-error *ngIf="cardForm.get('colonia')?.hasError('required')">
            La colonia es requerida
          </mat-error>
        </mat-form-field>

        <!-- Calle (editable) -->
        <mat-form-field appearance="outline" class="w-100 mb-3">
          <mat-label>Calle</mat-label>
          <input 
            matInput 
            formControlName="calle"
            placeholder="Filósofos 100"
            autocomplete="street-address"
          />
          <mat-icon matPrefix>home</mat-icon>
          <mat-error *ngIf="cardForm.get('calle')?.hasError('required')">
            La calle es requerida
          </mat-error>
        </mat-form-field>

        <!-- Calle Esquina / Referencias (editable) -->
        <mat-form-field appearance="outline" class="w-100 mb-3">
          <mat-label>Calle Esquina / Referencias</mat-label>
          <input 
            matInput 
            formControlName="calleEsquina"
            placeholder="Tecnologico"
          />
          <mat-icon matPrefix>place</mat-icon>
          <mat-error *ngIf="cardForm.get('calleEsquina')?.hasError('required')">
            La referencia es requerida
          </mat-error>
        </mat-form-field>

        <!-- País (oculto o al final, según necesidad) -->
        <mat-form-field appearance="outline" class="w-100 mb-3" style="display: none;">
          <mat-label>País</mat-label>
          <input 
            matInput 
            formControlName="pais"
            placeholder="MX"
            maxlength="2"
            autocomplete="country"
          />
          <mat-error *ngIf="cardForm.get('pais')?.hasError('required')">
            Requerido
          </mat-error>
        </mat-form-field>

        <div class="alert alert-info" *ngIf="validationMessage">
          <small>{{ validationMessage }}</small>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="p-3 border-top">
      <button mat-button (click)="cancelar()" type="button" [disabled]="loading">
        Cancelar
      </button>
      <button 
        mat-raised-button 
        color="primary" 
        (click)="tokenizarTarjeta()" 
        type="button"
        [disabled]="loading || cardForm.invalid"
      >
        <span *ngIf="loading">Procesando...</span>
        <span *ngIf="!loading">Agregar</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .card-form {
      padding: 1rem 0;
    }
    mat-form-field {
      width: 100%;
    }
    .alert-info {
      padding: 0.75rem;
      margin-bottom: 1rem;
      border: 1px solid #bee5eb;
      border-radius: 0.25rem;
      background-color: #d1ecf1;
      color: #0c5460;
    }
    .section-title {
      font-size: 1rem;
      font-weight: 600;
      color: #333;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #e0e0e0;
    }
    mat-dialog-content {
      max-height: 70vh;
      overflow-y: auto;
    }
  `]
})
export class NetpayDialogComponent implements OnInit, OnDestroy {
  loading = false;
  private deviceFingerPrint: string = '';
  cardForm: FormGroup;
  validationMessage: string = '';
  direccionesDisponibles: any[] = [];
  idDireccionSeleccionada: number | null = null;
  coloniasDisponibles: Array<{ idAsentamiento: number; nombre: string }> = [];
  cargandoColonias: boolean = false;

  constructor(
    private dialogRef: MatDialogRef<NetpayDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: NetpayDialogData,
    private ngZone: NgZone,
    private fb: FormBuilder,
    private netpayService: NetpayService
  ) {
    this.cardForm = this.fb.group({
      // Datos de la tarjeta
      cardNumber: ['', [Validators.required]],
      expMonth: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])$/)]],
      expYear: ['', [Validators.required, Validators.pattern(/^[0-9]{2}$/)]],
      cvv: ['', [Validators.required]],
      
      // Datos del cliente
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      apellidoPaterno: ['', [Validators.required]],
      apellidoMaterno: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      telefono: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      
      // Dirección
      ciudad: ['', [Validators.required]],
      pais: ['MX', [Validators.required]],
      codigoPostal: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
      estado: ['', [Validators.required]],
      calle: ['', [Validators.required]],
      calleEsquina: ['', [Validators.required]],
      colonia: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    // Inicializar NetPay
    setTimeout(() => {
      this.initNetpay();
    }, 100);
    
    // Usar las direcciones ya obtenidas en el componente padre
    if (this.data.direccionesDisponibles && Array.isArray(this.data.direccionesDisponibles)) {
      this.direccionesDisponibles = this.data.direccionesDisponibles;
    } else {
      this.direccionesDisponibles = [];
    }

    // Suscribirse a cambios en el código postal
    this.cardForm.get('codigoPostal')?.valueChanges.subscribe((value: string) => {
      if (value && value.length === 5 && !this.idDireccionSeleccionada) {
        this.obtenerColonias(value);
      } else if (value && value.length < 5) {
        // Limpiar colonias si el código postal no está completo
        this.coloniasDisponibles = [];
        this.cardForm.patchValue({ colonia: '' }, { emitEvent: false });
        // Habilitar y limpiar campos de Estado y Ciudad cuando se borra el código postal
        this.cardForm.get('estado')?.enable();
        this.cardForm.get('ciudad')?.enable();
        this.cardForm.patchValue({ estado: '' }, { emitEvent: false });
        this.cardForm.patchValue({ ciudad: '' }, { emitEvent: false });
      }
    });
  }

  onDireccionSeleccionada(direccion: any): void {
    if (!direccion) {
      // Limpiar campos si se selecciona "Ingresar nueva dirección"
      this.idDireccionSeleccionada = null;
      this.coloniasDisponibles = [];
      this.cardForm.patchValue({
        calle: '',
        calleEsquina: '',
        ciudad: '',
        estado: '',
        codigoPostal: '',
        pais: 'MX',
        colonia: ''
      });
      
      // Habilitar los campos de dirección
      this.cardForm.get('calle')?.enable();
      this.cardForm.get('calleEsquina')?.enable();
      this.cardForm.get('ciudad')?.enable();
      this.cardForm.get('estado')?.enable();
      this.cardForm.get('codigoPostal')?.enable();
      this.cardForm.get('pais')?.enable();
      this.cardForm.get('colonia')?.enable();
      
      // Hacer los campos de dirección obligatorios
      this.cardForm.get('calle')?.setValidators([Validators.required]);
      this.cardForm.get('calleEsquina')?.setValidators([Validators.required]);
      this.cardForm.get('ciudad')?.setValidators([Validators.required]);
      this.cardForm.get('estado')?.setValidators([Validators.required]);
      this.cardForm.get('codigoPostal')?.setValidators([Validators.required, Validators.pattern(/^\d{5}$/)]);
      this.cardForm.get('pais')?.setValidators([Validators.required]);
      this.cardForm.get('colonia')?.setValidators([Validators.required]);
      
      // Actualizar validaciones
      this.cardForm.get('calle')?.updateValueAndValidity();
      this.cardForm.get('calleEsquina')?.updateValueAndValidity();
      this.cardForm.get('ciudad')?.updateValueAndValidity();
      this.cardForm.get('estado')?.updateValueAndValidity();
      this.cardForm.get('codigoPostal')?.updateValueAndValidity();
      this.cardForm.get('pais')?.updateValueAndValidity();
      this.cardForm.get('colonia')?.updateValueAndValidity();
      
      return;
    }

    // Llenar los campos con la dirección seleccionada (solo para visualización)
    this.idDireccionSeleccionada = direccion.idDireccion;
    this.coloniasDisponibles = [];
    this.cardForm.patchValue({
      calle: direccion.calle || '',
      calleEsquina: direccion.calleEsquina || '',
      ciudad: direccion.ciudad || '',
      estado: direccion.estado || '',
      codigoPostal: direccion.CP || '',
      pais: direccion.pais || 'MX',
      colonia: direccion.colonia || ''
    });

    // Deshabilitar los campos de dirección cuando se selecciona una dirección existente
    this.cardForm.get('calle')?.disable();
    this.cardForm.get('calleEsquina')?.disable();
    this.cardForm.get('ciudad')?.disable();
    this.cardForm.get('estado')?.disable();
    this.cardForm.get('codigoPostal')?.disable();
    this.cardForm.get('pais')?.disable();
    this.cardForm.get('colonia')?.disable();

    // Quitar las validaciones de obligatorio para los campos de dirección
    this.cardForm.get('calle')?.clearValidators();
    this.cardForm.get('calleEsquina')?.clearValidators();
    this.cardForm.get('ciudad')?.clearValidators();
    this.cardForm.get('estado')?.clearValidators();
    this.cardForm.get('codigoPostal')?.clearValidators();
    this.cardForm.get('pais')?.clearValidators();
    this.cardForm.get('colonia')?.clearValidators();
    
    // Actualizar validaciones
    this.cardForm.get('calle')?.updateValueAndValidity();
    this.cardForm.get('calleEsquina')?.updateValueAndValidity();
    this.cardForm.get('ciudad')?.updateValueAndValidity();
    this.cardForm.get('estado')?.updateValueAndValidity();
    this.cardForm.get('codigoPostal')?.updateValueAndValidity();
    this.cardForm.get('pais')?.updateValueAndValidity();
    this.cardForm.get('colonia')?.updateValueAndValidity();
  }

  ngOnDestroy(): void {
    // Limpieza si es necesaria
  }

  private initNetpay(): void {
    this.ngZone.runOutsideAngular(() => {
      try {
        // Configurar Netpay
        NetPay.setApiKey(environment.NETPAY_PUBLIC_KEY);
        NetPay.setSandboxMode(environment.NETPAY_SANDBOX);

        // Generar device fingerprint
        this.deviceFingerPrint = NetPay.form.generateDeviceFingerPrint();
      } catch (error) {
        this.ngZone.run(() => {
          alert('Error al cargar el sistema de pago. Por favor, recargue la página.');
        });
      }
    });
  }

  formatCardNumber(event: any): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\s/g, '');
    
    // Permitir solo números
    value = value.replace(/\D/g, '');
    
    // Formatear con espacios cada 4 dígitos
    const formatted = value.match(/.{1,4}/g)?.join(' ') || value;
    input.value = formatted;
    
    // Actualizar el valor del formulario sin espacios
    this.cardForm.patchValue({ cardNumber: value }, { emitEvent: false });
    
    // Validar después de cambiar el valor
    this.validateCardForm();
  }

  formatMonth(event: any): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    
    if (value.length === 1 && parseInt(value) > 1) {
      value = '0' + value;
    }
    
    input.value = value;
    this.cardForm.patchValue({ expMonth: value }, { emitEvent: false });
    this.validateCardForm();
  }

  formatYear(event: any): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '');
    input.value = value;
    this.cardForm.patchValue({ expYear: value }, { emitEvent: false });
    this.validateCardForm();
  }

  formatCVV(event: any): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '');
    input.value = value;
    this.cardForm.patchValue({ cvv: value }, { emitEvent: false });
    this.validateCardForm();
  }

  formatTelefono(event: any): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '');
    input.value = value;
    this.cardForm.patchValue({ telefono: value }, { emitEvent: false });
  }

  formatCodigoPostal(event: any): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '');
    input.value = value;
    // Usar emitEvent: true para que se dispare valueChanges
    this.cardForm.patchValue({ codigoPostal: value }, { emitEvent: true });
  }

  onCodigoPostalBlur(): void {
    const codigoPostal = this.cardForm.get('codigoPostal')?.value;
    if (codigoPostal && codigoPostal.length === 5 && !this.idDireccionSeleccionada) {
      this.obtenerColonias(codigoPostal);
    }
  }

  obtenerColonias(codigoPostal: string): void {
    if (!codigoPostal || codigoPostal.length !== 5) {
      return;
    }

    // Solo obtener colonias si no hay una dirección seleccionada
    if (this.idDireccionSeleccionada) {
      return;
    }

    this.cargandoColonias = true;
    this.coloniasDisponibles = [];
    this.cardForm.patchValue({ colonia: '' }, { emitEvent: false }); // Limpiar selección anterior

    this.netpayService.obtenerColoniasPorCP(codigoPostal).subscribe(
      (response: any) => {
        this.cargandoColonias = false;

        // Normalizar respuesta del endpoint:
        // Caso nuevo:
        //   { estado: { nombre }, municipio: { nombre }, Colonias: [{ idAsentamiento, nombre }, ...] }
        // Casos anteriores/fallback:
        //   { codigo_postal: { estado: string, municipio: string, colonias: string[] } } u otros.
        const estadoNombre: string | null =
          response?.estado?.nombre ??
          response?.codigo_postal?.estado ??
          response?.estado ??
          null;

        const municipioNombre: string | null =
          response?.municipio?.nombre ??
          response?.codigo_postal?.municipio ??
          response?.municipio ??
          null;

        const coloniasRaw: any =
          response?.Colonias ??
          response?.codigo_postal?.Colonias ??
          response?.codigo_postal?.colonias ??
          response?.colonias ??
          response?.data ??
          (Array.isArray(response) ? response : null);

        if (Array.isArray(coloniasRaw)) {
          // Puede venir como array de strings (antiguo) o array de objetos (nuevo)
          if (coloniasRaw.length && typeof coloniasRaw[0] === 'string') {
            this.coloniasDisponibles = coloniasRaw
              .filter((x: any) => typeof x === 'string' && x.trim().length)
              .map((nombre: string, idx: number) => ({ idAsentamiento: idx + 1, nombre }));
          } else {
            this.coloniasDisponibles = coloniasRaw
              .map((c: any) => ({
                idAsentamiento: Number(c?.idAsentamiento ?? c?.id ?? c?.value),
                nombre: String(c?.nombre ?? c?.name ?? c?.label ?? '').trim(),
              }))
              .filter((c: any) => Number.isFinite(c.idAsentamiento) && !!c.nombre);
          }
        } else {
          this.coloniasDisponibles = [];
        }

        // Llenar automáticamente los campos de estado y ciudad/municipio
        if (estadoNombre) {
          this.cardForm.patchValue({ estado: estadoNombre }, { emitEvent: false });
          this.cardForm.get('estado')?.disable();
        }

        if (municipioNombre) {
          this.cardForm.patchValue({ ciudad: municipioNombre }, { emitEvent: false });
          this.cardForm.get('ciudad')?.disable();
        }

        // Actualizar validación del campo colonia
        if (this.coloniasDisponibles.length > 0) {
          // Si hay colonias disponibles, hacer el campo requerido
          this.cardForm.get('colonia')?.setValidators([Validators.required]);
        } else {
          // Si no hay colonias, quitar la validación requerida
          this.cardForm.get('colonia')?.clearValidators();
        }
        this.cardForm.get('colonia')?.updateValueAndValidity();

        // Si solo hay una colonia, seleccionarla automáticamente
        if (this.coloniasDisponibles.length === 1) {
          const coloniaValue = this.coloniasDisponibles[0];
          this.cardForm.patchValue({ colonia: coloniaValue }, { emitEvent: false });
        }
      },
      (error: any) => {
        this.cargandoColonias = false;
        this.coloniasDisponibles = [];
        // Quitar la validación requerida si hay error
        this.cardForm.get('colonia')?.clearValidators();
        this.cardForm.get('colonia')?.updateValueAndValidity();
      }
    );
  }

  private validateCardForm(): void {
    const cardNumber = this.cardForm.get('cardNumber')?.value || '';
    const expMonth = this.cardForm.get('expMonth')?.value || '';
    const expYear = this.cardForm.get('expYear')?.value || '';
    const cvv = this.cardForm.get('cvv')?.value || '';

    this.validationMessage = '';

    if (cardNumber) {
      const isValidNumber = NetPay.card.validateNumber(cardNumber);
      const isValidLength = NetPay.card.validateNumberLength(cardNumber);
      
      if (!isValidLength) {
        this.cardForm.get('cardNumber')?.setErrors({ invalid: true });
        this.validationMessage = 'Longitud de tarjeta inválida';
      } else if (!isValidNumber) {
        this.cardForm.get('cardNumber')?.setErrors({ invalid: true });
        this.validationMessage = 'Número de tarjeta inválido';
      } else {
        this.cardForm.get('cardNumber')?.setErrors(null);
      }
    }

    if (expMonth && expYear) {
      const isValidExpiry = NetPay.card.validateExpiry(expMonth, expYear);
      if (!isValidExpiry) {
        this.cardForm.get('expMonth')?.setErrors({ invalid: true });
        this.cardForm.get('expYear')?.setErrors({ invalid: true });
        this.validationMessage = 'Fecha de expiración inválida o vencida';
      } else {
        if (!this.cardForm.get('expMonth')?.hasError('pattern')) {
          this.cardForm.get('expMonth')?.setErrors(null);
        }
        if (!this.cardForm.get('expYear')?.hasError('pattern')) {
          this.cardForm.get('expYear')?.setErrors(null);
        }
      }
    }

    if (cvv && cardNumber) {
      const isValidCVV = NetPay.card.validateCVV(cvv, cardNumber);
      if (!isValidCVV) {
        this.cardForm.get('cvv')?.setErrors({ invalid: true });
        this.validationMessage = 'CVV inválido';
      } else {
        this.cardForm.get('cvv')?.setErrors(null);
      }
    }
  }

  tokenizarTarjeta(): void {
    if (this.cardForm.invalid || this.loading) {
      this.validationMessage = 'Por favor, complete todos los campos correctamente';
      return;
    }

    this.loading = true;
    this.validationMessage = '';

    const cardInfo = {
      cardNumber: this.cardForm.get('cardNumber')?.value,
      expMonth: this.cardForm.get('expMonth')?.value,
      expYear: this.cardForm.get('expYear')?.value,
      cvv2: this.cardForm.get('cvv')?.value,
      vault: true,
      simpleUse: false, // false porque se guardará la tarjeta
      deviceFingerPrint: this.deviceFingerPrint
    };

    // Callback de éxito
    const successCallback = (e: any) => {
      this.ngZone.run(() => {
        try {
          // Extraer el token de la respuesta
          let token = null;
          let referenceId = null;
          
          if (e?.message?.data) {
            try {
              if (typeof e.message.data === 'string') {
                const responseData = JSON.parse(e.message.data);
                token = responseData?.token;
                referenceId = responseData?.referenceId || responseData?.reference_id;
              } else if (typeof e.message.data === 'object') {
                token = e.message.data.token;
                referenceId = e.message.data.referenceId || e.message.data.reference_id;
              }
            } catch {
              /* respuesta del SDK en formato inesperado */
            }
          }
          
          if (!token && e?.message?.token) {
            token = e.message.token;
          }
          
          if (!token && e?.token) {
            token = e.token;
          }
          
          // Extraer referenceId de otras ubicaciones posibles
          if (!referenceId) {
            referenceId = e?.message?.referenceId || e?.message?.reference_id || e?.referenceId || e?.reference_id || null;
          }

          // Obtener deviceInformation
          let deviceInformation = e?.message?.deviceInformation || null;
          if (!deviceInformation) {
            try {
              deviceInformation = NetPay.form.deviceInformation();
            } catch {
              /* deviceInformation no disponible */
            }
          }

          if (!token) {
            this.loading = false;
            alert('Error: No se pudo procesar la tarjeta. Por favor, intente nuevamente.');
            return;
          }

          if (!deviceInformation) {
            this.loading = false;
            alert('Error: No se pudo obtener la información del dispositivo. Por favor, intente nuevamente.');
            return;
          }

          // Obtener la información del cliente del formulario
          const clienteInfo: any = {
            nombre: this.cardForm.get('nombre')?.value,
            apellidoPaterno: this.cardForm.get('apellidoPaterno')?.value,
            apellidoMaterno: this.cardForm.get('apellidoMaterno')?.value,
            email: this.cardForm.get('email')?.value,
            telefono: this.cardForm.get('telefono')?.value
          };

          // Si se seleccionó una dirección existente, solo enviar el ID
          if (this.idDireccionSeleccionada) {
            clienteInfo.idDireccion = this.idDireccionSeleccionada;
            // NO enviar el objeto direccion
          } else {
            // Si es nueva dirección, enviar los datos completos
            clienteInfo.idDireccion = null;
            const coloniaSel = this.cardForm.get('colonia')?.value as any;
            const coloniaNombre =
              typeof coloniaSel === 'string'
                ? coloniaSel
                : (coloniaSel?.nombre ?? null);
            clienteInfo.direccion = {
              ciudad: this.cardForm.get('ciudad')?.value,
              pais: this.cardForm.get('pais')?.value,
              CP: this.cardForm.get('codigoPostal')?.value,
              estado: this.cardForm.get('estado')?.value,
              calle: this.cardForm.get('calle')?.value,
              calleEsquina: this.cardForm.get('calleEsquina')?.value,
              colonia: coloniaNombre
            };
          }

          this.dialogRef.close({
            token: token,
            deviceFingerPrint: this.deviceFingerPrint,
            deviceInformation: deviceInformation,
            referenceId: referenceId,
            clienteInfo: clienteInfo
          });
        } catch {
          this.loading = false;
          alert('Error al procesar la respuesta. Por favor, intente nuevamente.');
        }
      });
    };

    // Callback de error
    const errorCallback = (e: any) => {
      this.ngZone.run(() => {
        this.loading = false;
        const errorMessage = e?.message || 'Ocurrió un error al procesar la tarjeta. Por favor, verifique los datos.';
        alert(errorMessage);
      });
    };

    // Crear el token usando NetPay.token.create()
    try {
      NetPay.token.create(cardInfo, successCallback, errorCallback);
    } catch {
      this.ngZone.run(() => {
        this.loading = false;
        alert('Error al procesar la tarjeta. Por favor, intente nuevamente.');
      });
    }
  }

  cancelar(): void {
    this.dialogRef.close();
  }
}

