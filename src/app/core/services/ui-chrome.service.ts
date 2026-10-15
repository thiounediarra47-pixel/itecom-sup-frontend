import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Lets a full-screen feature (e.g. taking a QCM) hide the app shell
 * (navbar/sidebar) so only its own content is visible.
 */
@Injectable({ providedIn: 'root' })
export class UiChromeService {
  private hiddenSubject = new BehaviorSubject<boolean>(false);
  hidden$ = this.hiddenSubject.asObservable();

  hide() { this.hiddenSubject.next(true); }
  show() { this.hiddenSubject.next(false); }
}
