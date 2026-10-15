import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({ name: 'markdownItalic', standalone: true })
export class MarkdownItalicPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}
  transform(value: string): SafeHtml {
    if (!value) return '';
    const html = value.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
