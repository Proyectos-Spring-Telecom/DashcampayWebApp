import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class S3SignedUrlService {
  constructor(private readonly http: HttpClient) {}

  firmar(url: string): Observable<string> {
    return this.http
      .post<{ url: string }>(`${environment.API_SECURITY}/s3/url-firmada`, { url })
      .pipe(map((body) => body?.url || ''));
  }
}
