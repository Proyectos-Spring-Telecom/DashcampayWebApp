import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { PasajerosService } from 'src/app/pages/services/pasajeros.service';
import { catchError, throwError } from 'rxjs';

export interface CambiarEstadoMonederoData {
  numeroSerie: string;
  idMonedero: number;
}

@Component({
  selector: 'vex-cambiar-estado-monedero-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './cambiar-estado-monedero-modal.component.html',
  styleUrl: './cambiar-estado-monedero-modal.component.scss'
})
export class CambiarEstadoMonederoModalComponent implements OnInit {
  estadoForm!: FormGroup;
  listaTiposPasajero: { id: number; nombre: string }[] = [];
  loading = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CambiarEstadoMonederoModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CambiarEstadoMonederoData,
    private pasajerosService: PasajerosService
  ) {}

  ngOnInit(): void {
    this.estadoForm = this.fb.group({
      idTipoPasajero: ['', Validators.required]
    });
    this.obtenerTiposPasajero();
  }

  obtenerTiposPasajero(): void {
    this.loading = true;
    this.pasajerosService.obtenerTiposPasajero().subscribe({
      next: (response: any) => {
        const data = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
        this.listaTiposPasajero = data.map((t: any) => ({
          id: Number(t?.id ?? t?.Id ?? t?.ID ?? 0),
          nombre: t?.nombre ?? t?.Nombre ?? ''
        })).filter((t: any) => Number.isFinite(t.id) && t.id > 0);
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al obtener tipos de pasajero:');
        this.listaTiposPasajero = [];
        this.loading = false;
      }
    });
  }

  cancelar(): void {
    this.dialogRef.close();
  }

  confirmar(): void {
    if (this.estadoForm.valid) {
      this.dialogRef.close(this.estadoForm.get('idTipoPasajero')?.value);
    }
  }
}

