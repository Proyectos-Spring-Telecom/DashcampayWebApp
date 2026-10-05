import { Component, Inject, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl, SafeUrl } from '@angular/platform-browser';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { allowedDocumentUrl } from 'src/app/core/security/safe-document-url';
import { S3SignedUrlService } from 'src/app/core/security/s3-signed-url.service';

export interface VerLicenciaData {
  url: string;
  titulo: string;
}

@Component({
  selector: 'vex-ver-licencia-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './ver-licencia-modal.component.html',
  styleUrl: './ver-licencia-modal.component.scss'
})
export class VerLicenciaModalComponent implements OnInit {
  urlSanitizada?: SafeResourceUrl;
  urlImgSanitizada?: SafeUrl;
  esImagen = false;

  constructor(
    private dialogRef: MatDialogRef<VerLicenciaModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: VerLicenciaData,
    private sanitizer: DomSanitizer,
    private s3: S3SignedUrlService,
  ) {}

  ngOnInit(): void {
    const candidata = allowedDocumentUrl(this.data.url);
    this.data.url = '';
    if (!candidata) return;
    this.s3.firmar(candidata).subscribe({
      next: (firmada) => {
        const ok = allowedDocumentUrl(firmada);
        if (!ok) return;
        this.data.url = ok;
        this.esImagen = this.isImageUrl(ok);
        if (this.esImagen) {
          this.urlImgSanitizada = this.sanitizer.bypassSecurityTrustUrl(ok);
          this.urlSanitizada = undefined;
        } else {
          this.urlSanitizada = this.sanitizer.bypassSecurityTrustResourceUrl(ok);
          this.urlImgSanitizada = undefined;
        }
      },
      error: () => {
        this.data.url = '';
      },
    });
  }

  abrirNuevaPestana() {
    if (this.data.url) {
      window.open(this.data.url, '_blank', 'noopener');
    }
  }

  async descargar() {
    if (!this.data.url) return;

    try {
      // Intentar descargar usando fetch para URLs remotas
      const response = await fetch(this.data.url, {
        method: 'GET',
        mode: 'cors'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      // Obtener la extensión del archivo desde la URL o determinar por tipo
      const urlLower = this.data.url.toLowerCase();
      let extension = '';
      if (urlLower.includes('.pdf')) {
        extension = '.pdf';
      } else if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) {
        extension = '.jpg';
      } else if (urlLower.includes('.png')) {
        extension = '.png';
      } else if (urlLower.includes('.gif')) {
        extension = '.gif';
      } else {
        // Intentar obtener extensión del Content-Type
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('pdf')) {
          extension = '.pdf';
        } else if (contentType?.includes('jpeg') || contentType?.includes('jpg')) {
          extension = '.jpg';
        } else if (contentType?.includes('png')) {
          extension = '.png';
        }
      }

      const fileName = (this.data.titulo || 'documento').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.href = url;
      link.download = fileName + extension;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al descargar:');
      // Fallback: intentar abrir en nueva pestaña si falla la descarga
      window.open(this.data.url, '_blank', 'noopener');
    }
  }

  cerrar(): void {
    this.dialogRef.close();
  }

  private isImageUrl(u: string): boolean {
    return /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(u);
  }
}

