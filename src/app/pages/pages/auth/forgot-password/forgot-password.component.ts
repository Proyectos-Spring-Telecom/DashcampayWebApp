import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { fadeInUp400ms } from '@vex/animations/fade-in-up.animation';
import { MatButtonModule } from '@angular/material/button';
import { NgIf } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { UsuariosService } from 'src/app/pages/services/usuarios.service';
import { AuthenticationService } from 'src/app/core/services/auth.service';
import { AlertsService } from '../../modal/alerts.service';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';

@Component({
  selector: 'vex-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss'],
  animations: [fadeInRight400ms],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    NgIf,
    RouterLink,
    MatButtonModule
  ]
})
export class ForgotPasswordComponent implements OnInit {
  resetForm!: UntypedFormGroup;
  submitted = false;
  error = '';
  success = '';
  loading = false;
  year: number = new Date().getFullYear();

  constructor(
    private formBuilder: UntypedFormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private alerts: AlertsService,
    private user: UsuariosService,
    private authenticationService: AuthenticationService
  ) { }

  ngOnInit() {
    document.body.setAttribute('class', 'authentication-bg');
    this.resetForm = this.formBuilder.group({
      userName: ['', [Validators.required, Validators.email]],
    });
  }

  ngAfterViewInit() {
  }

  type = 'password'
  myFunctionPasswordCurrent() {
    if (this.type === "password") {
      this.type = "text";
    } else {
      this.type = "password";
    }
  }

  ngOnDestroy() {
    document.body.classList.remove('authentication-bg')
  }

  get f() { return this.resetForm.controls; }

  agregar() {
    this.loading = true;
    this.textLogin = 'Cargando...';

    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      const etiquetas: any = {
        userName: 'Correo Electrónico',
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.resetForm.controls).forEach(key => {
        const control = this.resetForm.get(key);
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

      this.alerts.open({
        type: 'warning',
        title: '¡Ops!',
        message: `
        <p style="text-align: center; font-size: 15px; margin-bottom: 16px; color: white">
          Hay campos obligatorios sin completar.<br>
        </p>
        <div style="max-height: 350px; overflow-y: auto;">${lista}</div>
      `,
        confirmText: 'Entendido',
        backdropClose: false,
      });
      return;
    }

    this.loading = true;
    this.user.solicitarCambioContrasena(this.resetForm.value).subscribe({
      next: async () => {
        this.loading = false;
        this.textLogin = 'Confirmar';
        sessionStorage.removeItem('reset_token');
        sessionStorage.removeItem('token');
        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'Hemos enviado instrucciones para restablecer tu contraseña a tu correo electrónico.',
          showCancel: false,
          confirmText: 'Confirmar',
          cancelText: 'Cancelar'
        }).then((result: any) => {
          if (result === 'confirm') {
            this.router.navigate(['/login']);
          } else {
            
          }
        });
        this.resetForm.reset();
        this.submitted = false;
        this.router.navigate(['/login']);
      },

      error: async () => {
        this.loading = false;
        this.textLogin = 'Confirmar';
        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: 'Ocurrio un error al tratar de enviar el correo',
        });
      },

      complete: () => {
        this.loading = false;
      }
    });
  }

  public textLogin: string = 'Confirmar';
}
