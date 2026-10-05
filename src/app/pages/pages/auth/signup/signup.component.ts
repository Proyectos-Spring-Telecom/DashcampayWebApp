import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { fadeInUp400ms } from '@vex/animations/fade-in-up.animation';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { NgClass, NgIf } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Credentials } from 'src/app/entities/Credentials';
import { AuthenticationService } from 'src/app/core/services/auth.service';
import { catchError, Subscription, throwError } from 'rxjs';
import { User } from 'src/app/entities/User';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { AlertsService } from '../../modal/alerts.service';
import { UsuariosService } from 'src/app/pages/services/usuarios.service';
import {
  getPasswordGuideText,
  getPasswordRuleKey,
} from 'src/app/core/validators/password-policy';

@Component({
  selector: 'vex-signup',
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: [fadeInRight400ms],
    standalone: true,
    imports: [
      ReactiveFormsModule,
      MatFormFieldModule,
      MatInputModule,
      NgIf,
      NgClass,
      MatButtonModule,
      MatTooltipModule,
      MatIconModule,
      MatCheckboxModule,
      RouterLink,
      MatSnackBarModule
    ]
})
export class SignupComponent implements OnInit, OnDestroy {
  signupForm!: UntypedFormGroup;
  submitted = false;
  loading = false;
  public textLogin: string = 'Confirmar';
  type: 'text' | 'password' = 'password';
  resetToken: string | null = null;
  pwAllOk = false;
  pwGuideText = 'La contraseña debe tener al menos 12 caracteres.';
  pwGuideKey = 'needLength';
  matchText = 'Las contraseñas no coinciden';
  matchKey = 'noMatch';

  typeNew: 'text' | 'password' = 'password';
  typeConfirm: 'text' | 'password' = 'password';

  // ...

  // funciones independientes
  togglePasswordNew(): void {
    this.typeNew = this.typeNew === 'password' ? 'text' : 'password';
  }

  togglePasswordConfirm(): void {
    this.typeConfirm = this.typeConfirm === 'password' ? 'text' : 'password';
  }

  private subs: Subscription[] = [];

  constructor(
    private fb: UntypedFormBuilder,
    private route: ActivatedRoute,
    private user: UsuariosService,
    private router: Router,
    private alerts: AlertsService,
  ) { }

  ngOnInit(): void {
    this.resetToken = this.route.snapshot.queryParamMap.get('token');
    sessionStorage.removeItem('reset_token');
    sessionStorage.removeItem('token');

    this.signupForm = this.fb.group({
      userName: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
      confirmPassword: ['', [Validators.required]]
    });
    
    this.subs.push(
      this.signupForm.get('password')!.valueChanges.subscribe((val: string) => {
        const ruleKey = getPasswordRuleKey(val || '');
        this.pwGuideKey = ruleKey;
        this.pwGuideText = getPasswordGuideText(ruleKey);
        this.pwAllOk = ruleKey === 'ok';
        this.updateMatchHint();
      })
    );

    this.subs.push(
      this.signupForm.get('confirmPassword')!.valueChanges.subscribe(() => {
        this.updateMatchHint();
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  myFunctionPasswordCurrent(): void {
    this.type = this.type === 'password' ? 'text' : 'password';
  }

  get showPwHint(): boolean {
    const c = this.signupForm.get('password')!;
    return !!c.value || c.dirty || c.touched;
  }

  get showMatchHint(): boolean {
    const pass = this.signupForm.get('password')!.value;
    const confirm = this.signupForm.get('confirmPassword')!;
    return !!pass && (confirm.dirty || confirm.touched);
  }

  get passwordsMatch(): boolean {
    const pass = this.signupForm.get('password')!.value || '';
    const conf = this.signupForm.get('confirmPassword')!.value || '';
    return pass.length > 0 && conf.length > 0 && pass === conf;
  }

  private updateMatchHint(): void {
    const ok = this.passwordsMatch;
    this.matchText = ok ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden';
    this.matchKey = ok ? 'match' : 'noMatch';
  }
  
  agregar(): void {
    this.loading = true;
    this.textLogin = 'Cargando...';

    if (this.signupForm.invalid || !this.pwAllOk || !this.passwordsMatch) {
      this.signupForm.markAllAsTouched();
      return;
    }

    if (!this.resetToken) {
      return;
    }

    this.loading = true;
    const { userName, password } = this.signupForm.value;

    this.user.cambioContrasena({ userName, password }, this.resetToken!).subscribe({
      next: async () => {
        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: '¡Listo! Hemos actualizado tu contraseña de manera correcta.',
          showCancel: false,
          confirmText: 'Confirmar',
          cancelText: 'Cancelar'
        })
        this.loading = false;
        this.textLogin = 'Confirmar';
        sessionStorage.removeItem('reset_token');
        this.signupForm.reset();
        this.submitted = false;

        this.router.navigate(['/account', 'login']);
      }
      ,
      error: () => {
        this.loading = false;
        this.textLogin = 'Confirmar';
        this.alerts.open({
          type: 'error',
          title: '¡Ops!',
          message: 'Ocurrió un error al hacer el cambio de contraseña.',
          showCancel: false,
          confirmText: 'Confirmar',
          cancelText: 'Cancelar'
        })
      },
      complete: () => this.loading = false
    });
  }
}