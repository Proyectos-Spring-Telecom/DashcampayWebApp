import { Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { CommonModule } from '@angular/common';
import { OperadoresService } from 'src/app/pages/services/operadores.service';
import { AlertsService } from 'src/app/pages/pages/modal/alerts.service';

export interface AgregarLicenciaData {
  idOperador: number;
  nombreOperador: string;
}

@Component({
  selector: 'vex-agregar-licencia-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './agregar-licencia-modal.component.html',
  styleUrl: './agregar-licencia-modal.component.scss'
})
export class AgregarLicenciaModalComponent implements OnInit {
  licenciaForm!: FormGroup;
  public loading: boolean = false;
  public showRequiredMsgs: boolean = false;
  
  // Listas para selects
  public listaTiposLicencia: any[] = [];
  public listaCategoriasLicencia: any[] = [];

  // Archivo
  @ViewChild('licenciaInput') licenciaInput!: ElementRef<HTMLInputElement>;
  public licenciaFile: File | null = null;
  public licenciaFileName: string = '';
  public licenciaPreviewUrl: string | ArrayBuffer | null = null;
  public licenciaDragging: boolean = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<AgregarLicenciaModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AgregarLicenciaData,
    private operadoresService: OperadoresService,
    private alerts: AlertsService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.obtenerTiposLicencia();
    this.obtenerCategoriasLicencia();
  }

  initForm() {
    this.licenciaForm = this.fb.group({
      numeroLicencia: [null, [Validators.required, Validators.maxLength(20)]],
      fechaExpedicion: [null, Validators.required],
      fechaVencimiento: [null, Validators.required],
      idTipoLicencia: [null, Validators.required],
      idCategoriaLicencia: [null, Validators.required],
      licencia: [null, Validators.required]
    });
  }

  obtenerTiposLicencia() {
    this.operadoresService.obtenerTiposLicencia().subscribe({
      next: (response: any) => {
        this.listaTiposLicencia = (response.data || response || []).map((t: any) => ({
          ...t,
          id: Number(t?.idCatTipoLicencia ?? t?.IdCatTipoLicencia ?? t?.id ?? t?.Id ?? t?.ID ?? t?.idTipoLicencia ?? t?.IdTipoLicencia)
        }));
      },
      error: (error) => {
        console.error('Error al obtener tipos de licencia:');
        this.listaTiposLicencia = [];
      }
    });
  }

  obtenerCategoriasLicencia() {
    this.operadoresService.obtenerCategoriasLicencia().subscribe({
      next: (response: any) => {
        this.listaCategoriasLicencia = (response.data || response || []).map((c: any) => ({
          ...c,
          id: Number(c?.id ?? c?.Id ?? c?.ID ?? c?.idCategoriaLicencia ?? c?.IdCategoriaLicencia)
        }));
      },
      error: (error) => {
        console.error('Error al obtener categorías de licencia:');
        this.listaCategoriasLicencia = [];
      }
    });
  }

  openLicenciaFilePicker() {
    if (this.licenciaInput?.nativeElement) {
      this.licenciaInput.nativeElement.click();
    }
  }

  onLicenciaFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleLicenciaFile(input.files[0]);
    }
  }

  handleLicenciaFile(file: File) {
    // Validar tamaño (máx 3 MB)
    const maxSize = 3 * 1024 * 1024; // 3 MB en bytes
    if (file.size > maxSize) {
      this.alerts.open({
        type: 'error',
        title: 'Error',
        message: 'El archivo no debe exceder 3 MB.',
        confirmText: 'Entendido'
      });
      return;
    }

    // Validar tipo (PDF o imagen)
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      this.alerts.open({
        type: 'error',
        title: 'Error',
        message: 'El archivo debe ser un PDF o una imagen (JPG, PNG, GIF).',
        confirmText: 'Entendido'
      });
      return;
    }

    this.licenciaFile = file;
    this.licenciaFileName = file.name;
    this.licenciaForm.patchValue({ licencia: file });

    // Si es imagen, mostrar preview
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.licenciaPreviewUrl = e.target?.result || null;
      };
      reader.readAsDataURL(file);
    } else {
      this.licenciaPreviewUrl = null;
    }
  }

  clearLicenciaFile(event: Event) {
    event.stopPropagation();
    this.licenciaFile = null;
    this.licenciaFileName = '';
    this.licenciaPreviewUrl = null;
    this.licenciaForm.patchValue({ licencia: null });
    if (this.licenciaInput?.nativeElement) {
      this.licenciaInput.nativeElement.value = '';
    }
  }

  onLicenciaDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.licenciaDragging = true;
  }

  onLicenciaDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.licenciaDragging = false;
  }

  onLicenciaDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.licenciaDragging = false;

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      this.handleLicenciaFile(file);
    }
  }

  async submit() {
    this.showRequiredMsgs = true;

    if (this.licenciaForm.invalid) {
      const etiquetas: Record<string, string> = {
        numeroLicencia: 'N° Licencia',
        fechaExpedicion: 'Fecha Expedición',
        fechaVencimiento: 'Fecha Vencimiento',
        idTipoLicencia: 'Tipo de Licencia',
        idCategoriaLicencia: 'Categoría de Licencia',
        licencia: 'Licencia'
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.licenciaForm.controls).forEach((key) => {
        const control = this.licenciaForm.get(key);
        if (control?.invalid && control.errors?.['required']) {
          camposFaltantes.push(etiquetas[key] || key);
        }
        if (key === 'numeroLicencia' && control?.errors?.['maxlength']) {
          camposFaltantes.push('N° Licencia (máximo 20 caracteres)');
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

    this.loading = true;

    const formValue = this.licenciaForm.getRawValue();
    const formData = new FormData();

    formData.append('numeroLicencia', formValue.numeroLicencia);
    formData.append('fechaExpedicion', this.formatDate(formValue.fechaExpedicion));
    formData.append('fechaVencimiento', this.formatDate(formValue.fechaVencimiento));
    formData.append('idTipoLicencia', String(formValue.idTipoLicencia));
    formData.append('idCategoriaLicencia', String(formValue.idCategoriaLicencia));
    formData.append('idOperador', String(this.data.idOperador));

    if (formValue.licencia && formValue.licencia instanceof File) {
      formData.append('licencia', formValue.licencia);
    }

    this.operadoresService.agregarLicencia(formData).subscribe({
      next: async (response: any) => {
        this.loading = false;

        await this.alerts.open({
          type: 'success',
          title: '¡Éxito!',
          message: 'La licencia se ha registrado correctamente.',
          confirmText: 'Aceptar'
        });

        this.dialogRef.close(true);
      },
      error: async (error) => {
        this.loading = false;

        const errorMessage = error?.error?.message || error?.message || 'Error al registrar la licencia.';

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
    return `${year}-${month}-${day}`;
  }

  cancelar(): void {
    this.dialogRef.close();
  }
}

