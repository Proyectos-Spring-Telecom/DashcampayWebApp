import { Component, OnInit } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl, SafeUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { allowedDocumentUrl } from 'src/app/core/security/safe-document-url';
import { S3SignedUrlService } from 'src/app/core/security/s3-signed-url.service';

@Component({
  selector: 'vex-ver-documento-operador',
  templateUrl: './ver-documento-operador.component.html',
  styleUrls: ['./ver-documento-operador.component.scss']
})
export class VerDocumentoOperadorComponent implements OnInit {

  layoutCtrl = new UntypedFormControl('fullwidth');
  titulo = 'Documento';
  url?: string;
  urlSanitizada?: SafeResourceUrl;
  urlImgSanitizada?: SafeUrl;
  esImagen = false;
  private rawUrl = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer,
    private s3: S3SignedUrlService,
  ) {
    const nav = this.router.getCurrentNavigation();
    const state = (nav?.extras?.state as { url?: string; titulo?: string }) ?? {};

    this.rawUrl = state.url || this.route.snapshot.queryParamMap.get('url') || '';
    this.titulo = state.titulo || this.route.snapshot.queryParamMap.get('titulo') || 'Documento';
  }

  ngOnInit(): void {
    const candidata = allowedDocumentUrl(this.rawUrl);
    if (!candidata) return;
    this.s3.firmar(candidata).subscribe({
      next: (firmada) => {
        const ok = allowedDocumentUrl(firmada);
        if (!ok) return;
        this.url = ok;
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
        this.url = '';
      },
    });
  }

  abrirNuevaPestana() {
    if (this.url) window.open(this.url, '_blank', 'noopener');
  }

  volver() {
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  private isImageUrl(u: string): boolean {
    return /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(u);
  }
}
