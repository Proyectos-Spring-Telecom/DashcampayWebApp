import { Component, OnInit } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { fadeInRight400ms } from '@vex/animations/fade-in-right.animation';
import { allowedDocumentUrl } from 'src/app/core/security/safe-document-url';
import { S3SignedUrlService } from 'src/app/core/security/s3-signed-url.service';

@Component({
  selector: 'vex-ver-documento-cliente',
  templateUrl: './ver-documento-cliente.component.html',
  styleUrl: './ver-documento-cliente.component.scss',
  animations: [fadeInRight400ms],
})
export class VerDocumentoClienteComponent implements OnInit {
layoutCtrl = new UntypedFormControl('fullwidth');
  titulo = 'Documento';
  url?: string;
  urlSanitizada?: SafeResourceUrl;
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

  abrirNuevaPestana() {
    if (this.url) window.open(this.url, '_blank', 'noopener');
  }

  ngOnInit(): void {
    this.firmarYMostrar();
  }

  private firmarYMostrar() {
    const candidata = allowedDocumentUrl(this.rawUrl);
    if (!candidata) return;
    this.s3.firmar(candidata).subscribe({
      next: (firmada) => {
        const ok = allowedDocumentUrl(firmada);
        if (!ok) return;
        this.url = ok;
        this.urlSanitizada = this.sanitizer.bypassSecurityTrustResourceUrl(ok);
      },
      error: () => {
        this.url = '';
      },
    });
  }

    volver() {
    this.router.navigate(['../'], { relativeTo: this.route });
  }
}