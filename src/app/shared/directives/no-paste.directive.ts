import { Directive, HostListener } from '@angular/core';

@Directive({
  selector: '[noPaste]',
  standalone: true
})
export class NoPasteDirective {
  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
  }

  @HostListener('contextmenu', ['$event'])
  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }
}
