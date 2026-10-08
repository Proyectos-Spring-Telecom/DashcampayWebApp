import { mensajeDeError } from 'src/app/core/utils/mensaje-error';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, UntypedFormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';
import { ModulosService } from 'src/app/pages/services/modulos.service';
import { PermisosService } from 'src/app/pages/services/permisos.service';
import {
  bloquearCaracteresEspecialesNombre,
  NOMBRE_SIN_ESPECIALES_REGEX,
  onPasteNombreSinEspeciales
} from 'src/app/core/validators/nombre-sin-especiales';

@Component({
  selector: 'vex-alta-permiso',
  templateUrl: './alta-permiso.component.html',
  styleUrl: './alta-permiso.component.scss',
  animations: [fadeInRight400ms],
})
export class AltaPermisoComponent implements OnInit {


  layoutCtrl = new UntypedFormControl('fullwidth');
  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public listaModulos: any;
  public permisoForm!: FormGroup;
  public idPermiso!: number;
  public title = 'Agregar Permiso';
  public listaClientes: any[] = [];
  selectedFileName: string = '';
  previewUrl: string | ArrayBuffer | null = null;

  constructor(
    private fb: FormBuilder,
    private alerts: AlertsService,
    private permiService: PermisosService,
    private activatedRouted: ActivatedRoute,
    private route: Router,
    private moduSer: ModulosService
  ) { }

  ngOnInit(): void {
    this.initForm();
    this.obtenerModulo();
    this.activatedRouted.params.subscribe((params) => {
      this.idPermiso = params['idPermiso'];
      if (this.idPermiso) {
        this.title = 'Actualizar Permiso';
        this.obtenerPermiso();
      }
    });
  }

  public info: any;
  obtenerModulo() {
    this.moduSer.obtenerModulos().subscribe((response) => {
      this.listaModulos = (response?.data || []).map((m: any) => ({
        ...m,
        id: Number(m.id)
      }));
    });
  }

  obtenerPermiso() {
    this.permiService.obtenerPermiso(this.idPermiso).subscribe((response: any) => {
      const idModuloNum =
        response.data?.idModulo != null
          ? Number(response.data.idModulo)
          : response.data?.idModulo2?.id != null
            ? Number(response.data.idModulo2.id)
            : null;

      this.permisoForm.patchValue({
        nombre: response.data.nombre,
        descripcion: response.data.descripcion,
        idModulo: idModuloNum,
      });
    });
  }
  
  initForm() {
    this.permisoForm = this.fb.group({
      idModulo: [null, Validators.required],
      nombre: ['', [Validators.required, Validators.pattern(NOMBRE_SIN_ESPECIALES_REGEX)]],
      descripcion: ['', Validators.required],
    });
  }

  submit() {
    this.submitButton = 'Cargando...';
    this.loading = true;
    if (this.idPermiso) {
      this.actualizar();
    } else {
      this.agregar();
    }
  }

  async agregar() {
    this.submitButton = 'Cargando...';
    this.loading = true;

    if (this.permisoForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;

      const etiquetas: Record<string, string> = {
        nombre: 'Nombre',
        descripcion: 'Descripción',
        idModulo: 'Módulo',
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.permisoForm.controls).forEach(key => {
        const control = this.permisoForm.get(key);
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

      await this.alerts.open({
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

    // igual que en zonas: quitar 'id' antes de leer el payload
    if (this.permisoForm.contains('id')) this.permisoForm.removeControl('id');

    const payload = {
      ...this.permisoForm.getRawValue(),
      idModulo: Number(this.permisoForm.value.idModulo),
    };

    this.permiService.agregarPermiso(payload).subscribe(
      () => {
        this.submitButton = 'Guardar';
        this.loading = false;

        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'Se agregó un nuevo permiso de manera exitosa.',
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
          message: mensajeDeError(error),
          confirmText: 'Confirmar',
          backdropClose: false,
        });
      }
    );
  }

  async actualizar() {
    this.submitButton = 'Cargando...';
    this.loading = true;

    if (this.permisoForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;

      const etiquetas: Record<string, string> = {
        nombre: 'Nombre',
        descripcion: 'Descripción',
        idModulo: 'Módulo',
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.permisoForm.controls).forEach(key => {
        const control = this.permisoForm.get(key);
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

      await this.alerts.open({
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
      return; // importante salir si es inválido
    }

    const payload = {
      ...this.permisoForm.getRawValue(),
      idModulo: Number(this.permisoForm.value.idModulo),
    };

    this.permiService.actualizarPermiso(this.idPermiso, payload).subscribe(
      () => {
        this.submitButton = 'Actualizar';
        this.loading = false;

        this.alerts.open({
          type: 'success',
          title: '¡Operación Exitosa!',
          message: 'Los datos del permiso se actualizaron correctamente.',
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
          message: 'Ocurrió un error al actualizar el permiso.',
          confirmText: 'Confirmar',
          backdropClose: false,
        });
      }
    );
  }

  onPasteNombre(event: ClipboardEvent): void {
    onPasteNombreSinEspeciales(event, this.permisoForm.get('nombre'));
  }

  bloquearCaracteresEspecialesNombre = bloquearCaracteresEspecialesNombre;

  regresar() {
    this.route.navigateByUrl('/administracion/permisos');
  }
}
