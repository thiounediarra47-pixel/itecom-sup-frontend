import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Reference, CitationStyle } from '../models/reference.model';

@Injectable({ providedIn: 'root' })
export class ReferenceService {
  constructor(private http: HttpClient) {}

  getReferences(opts?: { collection?: string; search?: string }): Observable<Reference[]> {
    let params = new HttpParams();
    if (opts?.collection) params = params.set('collection', opts.collection);
    if (opts?.search)     params = params.set('search', opts.search);
    return this.http.get<Reference[]>('/api/references', { params });
  }

  getCollections(): Observable<string[]> {
    return this.http.get<string[]>('/api/references/collections');
  }

  create(ref: Partial<Reference>): Observable<Reference> {
    return this.http.post<Reference>('/api/references', ref);
  }

  update(id: number, ref: Partial<Reference>): Observable<Reference> {
    return this.http.put<Reference>(`/api/references/${id}`, ref);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`/api/references/${id}`);
  }

  // ── Citation formatter (client-side, no server needed) ──────────────────────

  formatCitation(ref: Reference, style: CitationStyle): string {
    const authors = this.formatAuthors(ref.authors ?? '', style);
    const year    = ref.year ?? 's.d.';
    const title   = ref.title ?? '';
    const pub     = ref.publisher ?? '';
    const place   = ref.place ?? '';

    switch (style) {
      case 'APA':  return this.apa(ref, authors, year, title, pub, place);
      case 'MLA':  return this.mla(ref, authors, title, pub, place, year);
      case 'Chicago': return this.chicago(ref, authors, year, title, pub, place);
      case 'IEEE': return this.ieee(ref, authors, title, year, pub, place);
      case 'Vancouver': return this.vancouver(ref, authors, title, year, pub, place);
      default: return '';
    }
  }

  private formatAuthors(raw: string, style: CitationStyle): string {
    if (!raw) return '';
    const names = raw.split(',').map(n => n.trim()).filter(Boolean);
    if (style === 'APA') {
      return names.map(n => {
        const parts = n.split(' ');
        if (parts.length < 2) return n;
        const last  = parts[parts.length - 1];
        const inits = parts.slice(0, -1).map(p => p[0] + '.').join(' ');
        return `${last}, ${inits}`;
      }).join(', ');
    }
    if (style === 'MLA') {
      if (names.length === 0) return '';
      if (names.length === 1) {
        const p = names[0].split(' ');
        return p.length > 1 ? `${p[p.length-1]}, ${p.slice(0,-1).join(' ')}` : names[0];
      }
      const first = names[0].split(' ');
      const firstFmt = first.length > 1 ? `${first[first.length-1]}, ${first.slice(0,-1).join(' ')}` : names[0];
      return `${firstFmt}, et al.`;
    }
    return names.join(', ');
  }

  private apa(r: Reference, authors: string, year: string, title: string, pub: string, place: string): string {
    if (r.refType === 'article' || r.refType === 'journal') {
      const pp = r.startPage && r.endPage ? `${r.startPage}–${r.endPage}` : (r.pages ?? '');
      const doi = r.doi ? ` https://doi.org/${r.doi}` : '';
      return `${authors} (${year}). ${title}. *${r.journal ?? ''}*, *${r.volume ?? ''}*(${r.issue ?? ''}), ${pp}.${doi}`;
    }
    if (r.refType === 'website') {
      return `${authors} (${year}). *${title}*. Récupéré de ${r.url ?? ''}`;
    }
    if (r.refType === 'thesis') {
      return `${authors} (${year}). *${title}* [${r.thesisType ?? 'Thèse de doctorat'}, ${r.university ?? ''}].`;
    }
    const placeStr = place && pub ? `${place} : ${pub}` : pub || place;
    return `${authors} (${year}). *${title}*. ${placeStr}.`;
  }

  private mla(r: Reference, authors: string, title: string, pub: string, place: string, year: string): string {
    if (r.refType === 'article' || r.refType === 'journal') {
      const pp = r.startPage && r.endPage ? `${r.startPage}-${r.endPage}` : (r.pages ?? '');
      return `${authors}. "${title}." *${r.journal ?? ''}*, vol. ${r.volume ?? ''}, no. ${r.issue ?? ''}, ${year}, pp. ${pp}.`;
    }
    if (r.refType === 'website') {
      return `${authors}. "${title}." *Web*, ${year}, ${r.url ?? ''}. Consulté le ${r.accessDate ?? ''}.`;
    }
    return `${authors}. *${title}*. ${pub}, ${year}.`;
  }

  private chicago(r: Reference, authors: string, year: string, title: string, pub: string, place: string): string {
    if (r.refType === 'article' || r.refType === 'journal') {
      const pp = r.startPage && r.endPage ? `${r.startPage}–${r.endPage}` : (r.pages ?? '');
      return `${authors}. "${title}." *${r.journal ?? ''}* ${r.volume ?? ''}, no. ${r.issue ?? ''} (${year}): ${pp}.`;
    }
    const placeStr = place && pub ? `${place}: ${pub}` : pub || place;
    return `${authors}. *${title}*. ${placeStr}, ${year}.`;
  }

  private ieee(r: Reference, authors: string, title: string, year: string, pub: string, place: string): string {
    const names = (r.authors ?? '').split(',').map(n => n.trim()).filter(Boolean);
    const ieeAuth = names.map(n => {
      const p = n.split(' ');
      if (p.length < 2) return n;
      return p.slice(0,-1).map(x => x[0]+'.').join(' ') + ' ' + p[p.length-1];
    }).join(', ');
    if (r.refType === 'article' || r.refType === 'journal') {
      const pp = r.startPage && r.endPage ? `pp. ${r.startPage}–${r.endPage}` : '';
      return `${ieeAuth}, "${title}," *${r.journal ?? ''}*, vol. ${r.volume ?? ''}, no. ${r.issue ?? ''}, ${pp}, ${year}.`;
    }
    const placeStr = place && pub ? `${place}: ${pub}` : pub || place;
    return `${ieeAuth}, *${title}*. ${placeStr}, ${year}.`;
  }

  private vancouver(r: Reference, authors: string, title: string, year: string, pub: string, place: string): string {
    const names = (r.authors ?? '').split(',').map(n => n.trim()).filter(Boolean);
    const vancAuth = names.map(n => {
      const p = n.split(' ');
      if (p.length < 2) return n;
      return `${p[p.length-1]} ${p.slice(0,-1).map(x => x[0]).join('')}`;
    }).join(', ');
    if (r.refType === 'article' || r.refType === 'journal') {
      const pp = r.startPage && r.endPage ? `${r.startPage}-${r.endPage}` : (r.pages ?? '');
      return `${vancAuth}. ${title}. ${r.journal ?? ''}. ${year};${r.volume ?? ''}(${r.issue ?? ''}):${pp}.`;
    }
    const placeStr = place && pub ? `${place}: ${pub}` : pub || place;
    return `${vancAuth}. ${title}. ${placeStr}; ${year}.`;
  }

  // ── BibTeX export ───────────────────────────────────────────────────────────

  toBibTeX(ref: Reference): string {
    const key = (ref.authors?.split(' ')[0] ?? 'Anon') + (ref.year ?? '');
    const type = ref.refType === 'article' || ref.refType === 'journal' ? 'article'
               : ref.refType === 'thesis' ? 'phdthesis'
               : ref.refType === 'website' ? 'misc'
               : 'book';
    const fields: string[] = [];
    const add = (k: string, v?: string) => { if (v) fields.push(`  ${k} = {${v}}`); };
    add('author', ref.authors); add('title', ref.title); add('year', ref.year);
    add('publisher', ref.publisher); add('address', ref.place);
    add('isbn', ref.isbn); add('journal', ref.journal);
    add('volume', ref.volume); add('number', ref.issue);
    add('pages', ref.startPage && ref.endPage ? `${ref.startPage}--${ref.endPage}` : ref.pages);
    add('doi', ref.doi); add('url', ref.url); add('note', ref.note);
    add('school', ref.university);
    return `@${type}{${key},\n${fields.join(',\n')}\n}`;
  }

  // ── ISBN / DOI lookup via backend proxy (évite les erreurs CORS) ─────────────

  lookupISBN(isbn: string): Observable<any> {
    const clean = isbn.replace(/[-\s]/g, '');
    return this.http.get(`/api/lookup/isbn/${clean}`);
  }

  lookupDOI(doi: string): Observable<any> {
    return this.http.get(`/api/lookup/doi`, { params: { doi } });
  }

  lookupZotero(userId: string, apiKey: string): Observable<any> {
    return this.http.get(`/api/lookup/zotero/${userId}/items`, {
      headers: { 'X-Zotero-Key': apiKey }
    });
  }
}
