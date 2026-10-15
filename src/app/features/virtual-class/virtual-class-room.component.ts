import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpContext } from '@angular/common/http';
import { SILENT_ERRORS } from '../../core/interceptors/error.interceptor';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { DialogService } from '../../core/services/dialog.service';

declare const JitsiMeetExternalAPI: any;

interface VirtualClass {
  id: number;
  title: string;
  description: string;
  scheduledAt: string;
  durationMinutes: number;
  roomName: string;
  recordingUrl: string | null;
  status: string;
  teacherName: string | null;
  courseTitle: string | null;
}

interface RollCallLine { name: string; email: string; status: 'PRESENT' | 'NO_ANSWER' | 'NOT_CONNECTED'; answeredAt: string | null; }

interface RollCall {
  id: number; startedAt: string; expiresAt: string; open: boolean;
  expected: number; present: number; noAnswer: number; notConnected: number; students: RollCallLine[];
}

interface JitsiTokenResponse {
  token: string;
  domain: string;
  roomName: string;
}

@Component({
  selector: 'app-virtual-class-room',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="fade-in-up">
      <div class="d-flex align-items-center gap-3 mb-3">
        <a routerLink="/virtual-class" class="btn btn-outline-secondary btn-sm">
          <i class="bi bi-arrow-left"></i>
        </a>
        <div>
          <h2 class="fw-bold mb-0">{{ vc?.title || 'Classe virtuelle' }}</h2>
          <p class="text-muted mb-0 small">{{ vc?.description }}</p>
        </div>
      </div>

      <div *ngIf="loading" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
      </div>

      <div *ngIf="!loading && vc">
        <div *ngIf="isTeacher && joinNotifications.length > 0" class="alert alert-success d-flex flex-column gap-1 py-2">
          <div *ngFor="let n of joinNotifications"><i class="bi bi-person-check-fill me-2"></i><strong>{{ n }}</strong> a rejoint la session.</div>
        </div>

        <!-- Rappel toutes les 15 minutes : faire l'appel -->
        <div *ngIf="isTeacher && reminderDue && !activeRollCall?.open" class="alert alert-warning d-flex flex-wrap align-items-center gap-2 shadow-sm roll-call-reminder" role="alert">
          <i class="bi bi-exclamation-triangle-fill fs-4"></i>
          <div class="flex-grow-1">
            <div class="fw-bold">Il est temps de faire l'appel</div>
            <div class="small">Vérifiez que tous les étudiants sont bien là : un appel toutes les {{ reminderMinutes }} minutes.</div>
          </div>
          <button class="btn btn-warning fw-semibold" [disabled]="rollCallBusy" (click)="startRollCall()">
            <i class="bi bi-person-raised-hand me-1"></i>Faire l'appel maintenant</button>
          <button class="btn btn-outline-secondary btn-sm" (click)="snoozeReminder()">Dans 5 minutes</button>
        </div>

        <div *ngIf="isTeacher && joined" class="card border-0 shadow-sm mb-3">
          <div class="card-body py-3">
            <div class="d-flex flex-wrap align-items-center gap-3">
              <span class="fw-semibold"><i class="bi bi-person-raised-hand me-2 text-primary"></i>Appel des étudiants</span>
              <button class="btn btn-sm btn-primary" [disabled]="rollCallBusy || activeRollCall?.open" (click)="startRollCall()">
                <span *ngIf="rollCallBusy" class="spinner-border spinner-border-sm me-1"></span>
                <i *ngIf="!rollCallBusy" class="bi bi-bell me-1"></i>Faire l'appel</button>
              <span *ngIf="!activeRollCall?.open" class="small text-muted"><i class="bi bi-alarm me-1"></i>Prochain rappel dans {{ nextReminderLabel }}</span>
              <span *ngIf="activeRollCall?.open" class="small text-muted"><i class="bi bi-hourglass-split me-1"></i>Appel en cours : {{ rollCallSecondsLeft }} s pour répondre</span>
            </div>

            <div *ngIf="activeRollCall as rc" class="mt-3">
              <div class="d-flex flex-wrap gap-2 mb-2 small">
                <span class="status-badge ok">{{ rc.present }} présent(s)</span>
                <span class="status-badge warn">{{ rc.noAnswer }} connecté(s) sans réponse</span>
                <span class="status-badge danger">{{ rc.notConnected }} non connecté(s)</span>
                <span class="text-muted">sur {{ rc.expected }} étudiant(s) · appel de {{ rc.startedAt | date:'HH:mm' }}</span>
                <button *ngIf="!rc.open" type="button" class="btn btn-link btn-sm p-0 ms-auto" (click)="activeRollCall = null">Masquer</button>
              </div>
              <div class="d-flex flex-wrap gap-2">
                <span *ngFor="let l of rc.students" class="badge border py-2 px-3 d-flex align-items-center gap-1"
                      [ngClass]="l.status === 'PRESENT' ? 'bg-success-subtle text-success-emphasis' : l.status === 'NO_ANSWER' ? 'bg-warning-subtle text-warning-emphasis' : 'bg-light text-muted'"
                      [title]="l.status === 'PRESENT' ? 'A répondu à ' + (l.answeredAt | date:'HH:mm:ss') : l.status === 'NO_ANSWER' ? 'Connecté, sans réponse' : 'Pas connecté'">
                  <i class="bi" [ngClass]="l.status === 'PRESENT' ? 'bi-check-circle-fill' : l.status === 'NO_ANSWER' ? 'bi-question-circle' : 'bi-x-circle'"></i>{{ l.name || l.email }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div *ngIf="isTeacher" class="card border-0 shadow-sm mb-3">
          <div class="card-body d-flex align-items-center gap-3 py-3">
            <span class="fw-semibold"><i class="bi bi-record-circle me-2 text-danger"></i>Enregistrement de la session</span>
            <button class="btn btn-sm btn-danger" *ngIf="!recording" (click)="startRecording()">
              <i class="bi bi-record-circle me-1"></i>Démarrer l'enregistrement
            </button>
            <button class="btn btn-sm btn-outline-danger" *ngIf="recording" (click)="stopRecording()">
              <i class="bi bi-stop-circle me-1"></i>Arrêter et enregistrer
            </button>
            <span *ngIf="recording" class="badge bg-danger">
              <i class="bi bi-record-circle-fill me-1"></i>Enregistrement en cours...
            </span>
            <span *ngIf="uploading" class="text-muted small">
              <span class="spinner-border spinner-border-sm me-1"></span>Envoi de l'enregistrement...
            </span>
            <button class="btn btn-sm btn-outline-secondary" (click)="endSession()" [disabled]="ending">
              <span *ngIf="ending" class="spinner-border spinner-border-sm me-1"></span>
              <i *ngIf="!ending" class="bi bi-box-arrow-right me-1"></i>
              {{ ending ? "Sauvegarde de l'enregistrement..." : 'Terminer la session' }}
            </button>
          </div>
        </div>

        <div *ngIf="isTeacher" class="card border-0 shadow-sm mb-3">
          <div class="card-body py-3">
            <h6 class="fw-bold mb-2">
              <i class="bi bi-people-fill me-2 text-primary"></i>Participants connectés
              <span class="badge bg-primary ms-1">{{ connectedParticipants.length }}</span>
            </h6>
            <div *ngIf="connectedParticipants.length === 0" class="text-muted small">
              Aucun étudiant connecté pour le moment.
            </div>
            <div class="d-flex flex-wrap gap-2">
              <span class="badge bg-light text-dark border d-flex align-items-center gap-1 py-2 px-3" *ngFor="let p of connectedParticipants">
                <i class="bi bi-person-circle text-success"></i>{{ p.name }}
              </span>
            </div>
          </div>
        </div>

        <div *ngIf="uploadSuccess" class="alert alert-success">
          <i class="bi bi-check-circle me-2"></i>Enregistrement sauvegardé dans la plateforme. Il sera disponible dans l'onglet "Passées".
        </div>
        <div *ngIf="uploadError" class="alert alert-danger">
          <i class="bi bi-exclamation-circle me-2"></i>{{ uploadError }}
        </div>

        <div *ngIf="!joined" class="alert alert-info d-flex flex-wrap align-items-center gap-2">
          <i class="bi bi-info-circle me-2"></i>
          <span class="flex-grow-1">
            Si une fenêtre <strong>"Rejoindre la réunion" / "Join Meeting"</strong> s'affiche dans la vidéo ci-dessous
            (avec les réglages caméra/micro), cliquez dessus pour entrer dans la session.
          </span>
          <button *ngIf="showReload" class="btn btn-sm btn-outline-primary" (click)="reloadConference()">
            <i class="bi bi-arrow-clockwise me-1"></i>Recharger la visioconférence
          </button>
        </div>

        <div #jitsiContainer style="width:100%; height:75vh; border-radius:12px; overflow:hidden" class="shadow-sm"></div>

        <details class="mt-3">
          <summary class="text-muted small">Diagnostic technique (en cas de problème de connexion)</summary>
          <div class="bg-dark text-light p-2 mt-1 rounded small" style="font-family:monospace; max-height:200px; overflow:auto">
            <div *ngFor="let line of debugLog">{{ line }}</div>
          </div>
        </details>
      </div>
    </div>
  `,
  styles: [`
    .roll-call-reminder { position: sticky; top: 72px; z-index: 5; border-left: 6px solid #b4690e; }
  `]
})
export class VirtualClassRoomComponent implements OnInit, OnDestroy {
  @ViewChild('jitsiContainer', { static: false }) jitsiContainer!: ElementRef<HTMLDivElement>;

  vc: VirtualClass | null = null;
  loading = true;
  recording = false;
  uploading = false;
  uploadSuccess = false;
  uploadError = '';
  knockingParticipants: { id: string; name: string }[] = [];
  connectedParticipants: { id: string; name: string }[] = [];
  joinNotifications: string[] = [];
  debugLog: string[] = [];
  joined = false;
  showReload = false;
  ending = false;

  private joinTimeoutHandle: any;

  // Présence : une connexion enregistrée côté serveur, confirmée toutes les 30 s
  private attendanceId: number | null = null;
  private attendanceHeartbeat: ReturnType<typeof setInterval> | null = null;
  private static readonly HEARTBEAT_MS = 30000;

  // Appel : rappel au professeur toutes les 15 minutes, réponse « Je suis présent » des étudiants
  readonly reminderMinutes = 15;
  reminderDue = false;
  nextReminderAt = 0;
  activeRollCall: RollCall | null = null;
  rollCallBusy = false;
  private now = Date.now();
  private reminderTicker: ReturnType<typeof setInterval> | null = null;
  private rollCallPoll: ReturnType<typeof setInterval> | null = null;
  private studentCallPoll: ReturnType<typeof setInterval> | null = null;
  private answeringCallId: number | null = null;

  private jitsiApi: any;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private displayStream: MediaStream | null = null;
  private micStream: MediaStream | null = null;
  private recordingAudioCtx: AudioContext | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    public authService: AuthService,
    private dialogs: DialogService
  ) {}

  get isTeacher(): boolean {
    return this.authService.isTeacher || this.authService.isAdmin;
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    this.http.get<VirtualClass>(`/api/virtual-classes/${id}`).subscribe({
      next: (data) => {
        this.vc = data;
        this.loading = false;
        setTimeout(() => this.initJitsi(), 0);
      },
      error: () => { this.loading = false; }
    });
  }

  /**
   * Si l'enseignant ferme l'onglet/le navigateur pendant un enregistrement,
   * la page est déchargée immédiatement : onstop() ne se déclenche jamais
   * et l'enregistrement est perdu sans avertissement. On bloque donc la
   * fermeture tant que l'enregistrement est en cours ou en cours d'envoi.
   */
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent) {
    this.leaveAttendance(true);
    if (this.recording || this.uploading) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  ngOnDestroy() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.displayStream?.getTracks().forEach(t => t.stop());
    clearTimeout(this.joinTimeoutHandle);
    this.stopRollCallTimers();
    this.leaveAttendance();
    this.jitsiApi?.dispose();
  }

  // --- Appel ---

  get nextReminderLabel(): string {
    const s = Math.max(0, Math.round((this.nextReminderAt - this.now) / 1000));
    return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
  }

  get rollCallSecondsLeft(): number {
    return this.activeRollCall ? Math.max(0, Math.round((new Date(this.activeRollCall.expiresAt).getTime() - this.now) / 1000)) : 0;
  }

  /** Démarre le rappel (professeur) ou l'écoute des appels (étudiant) une fois dans la salle. */
  private startRollCallTimers() {
    if (this.isTeacher) {
      if (this.reminderTicker) return;
      this.nextReminderAt = Date.now() + this.reminderMinutes * 60_000;
      this.reminderTicker = setInterval(() => {
        this.now = Date.now();
        if (!this.reminderDue && !this.activeRollCall?.open && this.now >= this.nextReminderAt) this.raiseReminder();
      }, 1000);
    } else if (!this.studentCallPoll) {
      this.checkStudentRollCall();
      this.studentCallPoll = setInterval(() => this.checkStudentRollCall(), 15_000);
    }
  }

  private stopRollCallTimers() {
    [this.reminderTicker, this.rollCallPoll, this.studentCallPoll].forEach(t => t && clearInterval(t));
    this.reminderTicker = this.rollCallPoll = this.studentCallPoll = null;
  }

  /** Avertissement : bandeau, son et notification du navigateur si l'onglet n'est pas affiché. */
  private raiseReminder() {
    this.reminderDue = true;
    this.beep();
    this.dialogs.toast('Rappel : faites l\'appel pour vérifier que tout le monde est là.', 'warning', 8000);
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('ITECOM — Faire l\'appel', { body: `${this.vc?.title ?? 'Classe virtuelle'} : vérifiez que tous les étudiants sont là.` });
    }
  }

  snoozeReminder() {
    this.reminderDue = false;
    this.nextReminderAt = Date.now() + 5 * 60_000;
  }

  startRollCall() {
    if (!this.vc || this.rollCallBusy) return;
    // Autorise les notifications du navigateur pour les prochains rappels (onglet en arrière-plan)
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
    this.rollCallBusy = true;
    this.http.post<RollCall>(`/api/teacher/virtual-classes/${this.vc.id}/roll-calls`, {}).subscribe({
      next: rc => {
        this.rollCallBusy = false;
        this.activeRollCall = rc;
        this.reminderDue = false;
        this.nextReminderAt = Date.now() + this.reminderMinutes * 60_000;
        this.dialogs.toast('Appel lancé : les étudiants connectés doivent confirmer leur présence.', 'info');
        if (this.rollCallPoll) clearInterval(this.rollCallPoll);
        this.rollCallPoll = setInterval(() => this.refreshRollCall(), 4000);
      },
      error: err => { this.rollCallBusy = false; this.dialogs.toast(err.error?.message || 'Impossible de lancer l\'appel.', 'danger'); }
    });
  }

  private refreshRollCall() {
    if (!this.vc || !this.activeRollCall) return;
    this.http.get<RollCall>(`/api/teacher/virtual-classes/${this.vc.id}/roll-calls/${this.activeRollCall.id}`,
      { context: new HttpContext().set(SILENT_ERRORS, true) }).subscribe({
      next: rc => {
        this.activeRollCall = rc;
        if (!rc.open && this.rollCallPoll) {
          clearInterval(this.rollCallPoll);
          this.rollCallPoll = null;
          const missing = rc.noAnswer + rc.notConnected;
          this.dialogs.toast(missing ? `Appel terminé : ${rc.present} présent(s), ${missing} sans réponse.` : 'Appel terminé : tout le monde est là.',
            missing ? 'warning' : 'success', 6000);
        }
      },
      error: () => {}
    });
  }

  /** Étudiant : si un appel est ouvert, demande « Je suis présent ». */
  private checkStudentRollCall() {
    if (!this.vc || this.answeringCallId) return;
    const classId = this.vc.id;
    this.http.get<{ id: number; secondsLeft: number } | null>(`/api/virtual-classes/${classId}/roll-calls/active`,
      { context: new HttpContext().set(SILENT_ERRORS, true) }).subscribe({
      next: call => {
        if (!call || this.answeringCallId) return;
        this.answeringCallId = call.id;
        this.beep();
        this.dialogs.alert({
          title: 'Appel du professeur', icon: 'bi-person-raised-hand', tone: 'warning', confirmText: 'Je suis présent',
          message: `Confirmez votre présence dans les ${Math.ceil(call.secondsLeft / 60)} minute(s). Sans réponse, vous serez noté(e) absent(e) à cet appel.`
        }).then(() => {
          this.http.post(`/api/virtual-classes/${classId}/roll-calls/${call.id}/answer`, {}).subscribe({
            next: () => { this.answeringCallId = null; this.dialogs.toast('Présence confirmée.'); },
            error: err => { this.answeringCallId = null; this.dialogs.toast(err.error?.message || 'Présence non enregistrée.', 'danger'); }
          });
        });
      },
      error: () => {}
    });
  }

  /** Court signal sonore pour attirer l'attention. */
  private beep() {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
      osc.onended = () => ctx.close();
    } catch { /* son indisponible : le bandeau suffit */ }
  }

  // --- Présence ---

  private joinAttendance() {
    if (!this.vc || this.attendanceId) return;
    const classId = this.vc.id;
    this.http.post<{ attendanceId: number }>(`/api/virtual-classes/${classId}/attendance/join`, {},
      { context: new HttpContext().set(SILENT_ERRORS, true) }).subscribe({
      next: r => {
        this.attendanceId = r.attendanceId;
        this.attendanceHeartbeat = setInterval(() => {
          if (!this.attendanceId) return;
          this.http.post(`/api/virtual-classes/${classId}/attendance/${this.attendanceId}/heartbeat`, {},
            { context: new HttpContext().set(SILENT_ERRORS, true) }).subscribe({ error: () => {} });
        }, VirtualClassRoomComponent.HEARTBEAT_MS);
      },
      error: () => this.log('Présence non enregistrée (erreur serveur)')
    });
  }

  /** @param unloading page en cours de fermeture : envoi en keepalive pour que la requête aboutisse. */
  private leaveAttendance(unloading = false) {
    if (this.attendanceHeartbeat) { clearInterval(this.attendanceHeartbeat); this.attendanceHeartbeat = null; }
    if (!this.vc || !this.attendanceId) return;
    const url = `/api/virtual-classes/${this.vc.id}/attendance/${this.attendanceId}/leave`;
    this.attendanceId = null;
    if (unloading) {
      const token = this.authService.getToken();
      fetch(url, { method: 'POST', keepalive: true, headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(() => {});
    } else {
      this.http.post(url, {}, { context: new HttpContext().set(SILENT_ERRORS, true) }).subscribe({ error: () => {} });
    }
  }

  reloadConference() {
    this.log('Rechargement manuel de la visioconférence...');
    this.showReload = false;
    this.joined = false;
    clearTimeout(this.joinTimeoutHandle);
    try { this.jitsiApi?.dispose(); } catch { /* ignore */ }
    this.jitsiApi = null;
    this.connectedParticipants = [];
    this.knockingParticipants = [];
    setTimeout(() => this.initJitsi(), 100);
  }

  private loadJitsiScript(domain: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof JitsiMeetExternalAPI !== 'undefined') {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = `https://${domain}/external_api.js`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Impossible de charger Jitsi Meet'));
      document.body.appendChild(script);
    });
  }

  private async initJitsi() {
    if (!this.vc) return;
    try {
      this.log('Demande du jeton sécurisé Jitsi...');
      const jitsi = await firstValueFrom(
        this.http.get<JitsiTokenResponse>(`/api/virtual-classes/${this.vc.id}/jitsi-token`)
      );
      this.log('Jeton obtenu. Chargement de Jitsi...');
      await this.loadJitsiScript(jitsi.domain);
      this.log('Script chargé. Création de la salle "' + jitsi.roomName + '"...');
      const user = this.authService.currentUser;
      this.jitsiApi = new JitsiMeetExternalAPI(jitsi.domain, {
        roomName: jitsi.roomName,
        jwt: jitsi.token,
        parentNode: this.jitsiContainer.nativeElement,
        width: '100%',
        height: '100%',
        userInfo: {
          displayName: user ? `${user.firstName} ${user.lastName}` : 'Utilisateur'
        },
        configOverwrite: {
          prejoinPageEnabled: false,
          prejoinConfig: { enabled: false },
          requireDisplayName: false,
          lobby: { enabled: false },
          hideLobbyButton: true,
          enableLobbyChat: false,
          disableDeepLinking: true
        }
      });

      // Si l'embed reste bloqué sur l'écran de pré-connexion de meet.jit.si
      // (videoConferenceJoined jamais déclenché), on propose un bouton pour
      // recharger l'iframe, qui résout parfois le blocage.
      this.showReload = false;
      clearTimeout(this.joinTimeoutHandle);
      this.joinTimeoutHandle = setTimeout(() => {
        if (!this.joined) {
          this.log('Toujours pas connecté après 8s, affichage du bouton de rechargement.');
          this.showReload = true;
        }
      }, 8000);

      this.jitsiApi.addListener('videoConferenceJoined', (event: any) => {
        this.joined = true;
        this.showReload = false;
        clearTimeout(this.joinTimeoutHandle);
        this.log('videoConferenceJoined : ' + (event?.displayName || '') + ' (id=' + event?.id + ')');
        this.joinAttendance();
        this.startRollCallTimers();
        // Récupère les participants déjà présents dans le salon au moment
        // où le professeur ouvre la page (ex: étudiants connectés avant lui).
        const existing = this.jitsiApi.getParticipantsInfo?.() || [];
        this.log('Participants déjà présents : ' + existing.length);
        for (const p of existing) {
          this.addParticipant(p.participantId, p.displayName);
        }
      });

      this.jitsiApi.addListener('videoConferenceLeft', () => {
        this.log('videoConferenceLeft');
        this.leaveAttendance();
      });

      this.jitsiApi.addListener('participantRoleChanged', (event: any) => {
        this.log('participantRoleChanged : id=' + event?.id + ' role=' + event?.role);
      });

      // Liste des participants connectés, affichée côté professeur.
      this.jitsiApi.addListener('participantJoined', (event: any) => {
        this.log('participantJoined : ' + (event?.displayName || event?.id));
        this.addParticipant(event?.id, event?.displayName);
        this.knockingParticipants = this.knockingParticipants.filter(p => p.id !== event?.id);
        if (this.isTeacher && event?.displayName) {
          this.notifyJoin(event.displayName);
        }
      });
      this.jitsiApi.addListener('participantLeft', (event: any) => {
        this.log('participantLeft : ' + event?.id);
        this.connectedParticipants = this.connectedParticipants.filter(p => p.id !== event?.id);
      });

      this.jitsiApi.addListener('readyToClose', () => {
        this.log('readyToClose (la session a été quittée côté Jitsi)');
      });
    } catch (e: any) {
      const detail = e?.error?.message || e?.message || 'Erreur inconnue';
      this.log('ERREUR : ' + detail);
      this.uploadError = `Impossible de charger la visioconférence : ${detail}`;
    }
  }

  private log(message: string) {
    const time = new Date().toLocaleTimeString();
    this.debugLog.push(`[${time}] ${message}`);
  }

  private addParticipant(id: string, name: string) {
    if (id && !this.connectedParticipants.some(p => p.id === id)) {
      this.connectedParticipants.push({ id, name: name || 'Participant' });
    }
  }

  private notifyJoin(name: string) {
    this.joinNotifications.push(name);
    setTimeout(() => {
      this.joinNotifications = this.joinNotifications.filter(n => n !== name);
    }, 5000);
  }

  async startRecording() {
    this.uploadError = '';
    this.uploadSuccess = false;
    try {
      // 1. Capturer l'écran (+ audio système si l'utilisateur l'autorise)
      this.displayStream = await (navigator.mediaDevices as any).getDisplayMedia({
        // Qualité adaptée à un cours (écran partagé, tableau) : fichiers légers, rapides à revoir
        video: { width: 960, height: 540, frameRate: 12 },
        audio: true
      });

      // 2. Capturer le microphone de l'appareil connecté
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch {
        this.micStream = null;
      }

      // 3. Mixer audio système + micro via AudioContext
      this.recordingAudioCtx = new AudioContext();
      const dest = this.recordingAudioCtx.createMediaStreamDestination();

      const display = this.displayStream!;
      const audioCtx = this.recordingAudioCtx!;

      if (display.getAudioTracks().length > 0) {
        const sysSource = audioCtx.createMediaStreamSource(
          new MediaStream(display.getAudioTracks())
        );
        sysSource.connect(dest);
      }
      if (this.micStream && this.micStream.getAudioTracks().length > 0) {
        const micSource = audioCtx.createMediaStreamSource(this.micStream);
        micSource.connect(dest);
      }

      // 4. Stream final : vidéo écran + audio mixé
      const combined = new MediaStream([
        ...display.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ]);

      // 5. Lancer l'enregistrement
      this.recordedChunks = [];
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';
      // ~200 kbit/s au total (≈ 90 Mo par heure) ; le serveur en tire ensuite une version encore plus légère
      this.mediaRecorder = new MediaRecorder(combined, {
        mimeType,
        videoBitsPerSecond: 170_000,
        audioBitsPerSecond: 32_000
      });
      this.mediaRecorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) this.recordedChunks.push(e.data);
      };
      this.mediaRecorder.onstop = () => this.uploadRecording(this.stopCallback);
      display.getVideoTracks()[0].onended = () => this.stopRecording();
      this.mediaRecorder.start();
      this.recording = true;
    } catch (e) {
      this.uploadError = "Impossible de démarrer l'enregistrement (autorisation refusée).";
    }
  }

  /** Appelé une fois l'enregistrement arrêté ET envoyé (ou s'il n'y avait rien à envoyer). */
  private stopCallback: (() => void) | null = null;

  stopRecording(onStopped?: () => void) {
    this.stopCallback = onStopped || null;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      // mediaRecorder.stop() est asynchrone : onstop (qui déclenche l'upload)
      // ne se déclenche qu'après ce stop(). On attend donc onstop avant
      // d'appeler le callback (ex: navigation après "Terminer la session").
      this.mediaRecorder.stop();
    } else {
      this.uploadRecording(this.stopCallback);
    }
    this.displayStream?.getTracks().forEach(t => t.stop());
    this.micStream?.getTracks().forEach(t => t.stop());
    this.micStream = null;
    this.recordingAudioCtx?.close();
    this.recordingAudioCtx = null;
    this.recording = false;
  }

  private uploadRecording(onDone?: (() => void) | null) {
    if (!this.vc || this.recordedChunks.length === 0) {
      onDone?.();
      return;
    }
    const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
    const filename = `session-${this.vc.id}.webm`;

    // Envoyé en fichier (plus de base64) : jusqu'à 600 Mo, soit plus de 6 heures à ce débit
    if (blob.size > 600 * 1024 * 1024) {
      const sizeMb = Math.round(blob.size / (1024 * 1024));
      this.uploadError = `Enregistrement trop volumineux (${sizeMb} Mo, maximum 600 Mo). Faites des enregistrements plus courts.`;
      onDone?.();
      return;
    }

    this.uploading = true;
    this.extractThumbnailFromBlob(blob).then(thumbnailBase64 => {
      const body = new FormData();
      body.append('file', blob, filename);
      if (thumbnailBase64) body.append('thumbnail', thumbnailBase64);
      this.http.post(`/api/teacher/virtual-classes/${this.vc!.id}/recording`, body).subscribe({
        next: () => {
          this.uploading = false;
          this.uploadSuccess = true;
          if (this.vc) this.vc.status = 'COMPLETED';
          onDone?.();
        },
        error: () => {
          this.uploading = false;
          this.uploadError = "Erreur lors de l'envoi de l'enregistrement vers la plateforme.";
          onDone?.();
        }
      });
    });
  }

  private extractThumbnailFromBlob(blob: Blob): Promise<string> {
    return new Promise(resolve => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(blob);
      video.src = url;
      video.muted = true;
      video.currentTime = 1;
      video.onloadeddata = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, 320, 180);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl.split(',')[1]);
        } else {
          resolve('');
        }
        URL.revokeObjectURL(url);
      };
      video.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
    });
  }

  endSession() {
    if (!this.vc) return;
    const finish = () => {
      this.ending = false;
      if (this.isTeacher && this.vc!.status !== 'COMPLETED') {
        this.http.put(`/api/teacher/virtual-classes/${this.vc!.id}/status`, {}, { params: { status: 'COMPLETED' } }).subscribe({
          next: () => this.router.navigate(['/virtual-class']),
          error: () => this.router.navigate(['/virtual-class'])
        });
      } else {
        this.router.navigate(['/virtual-class']);
      }
    };

    if (this.recording) {
      // On attend que l'enregistrement soit arrêté ET envoyé au serveur
      // avant de quitter la page, sinon le cours enregistré est perdu.
      this.ending = true;
      this.stopRecording(finish);
    } else {
      finish();
    }
  }
}
