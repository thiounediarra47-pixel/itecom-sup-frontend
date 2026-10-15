import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ExamService } from '../../core/services/exam.service';
import { ExamTakeResponse, ExamQuestion, StudentAnswer } from '../../core/models/exam.model';
import { UiChromeService } from '../../core/services/ui-chrome.service';
import { AuthService } from '../../core/services/auth.service';
import { DialogService } from '../../core/services/dialog.service';

type PageStatus = 'loading' | 'welcome' | 'active' | 'submitted' | 'error' | 'already-submitted' | 'terminated' | 'blocked';

@Component({
  selector: 'app-exam-take',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-vh-100 d-flex flex-column" style="background:var(--surface-muted)"
         [style.height]="status === 'active' ? '100vh' : null"
         [style.overflow]="status === 'active' ? 'hidden' : null">
      <nav class="navbar navbar-light bg-white border-bottom shadow-sm px-4 py-3">
        <span class="navbar-brand fw-bold text-primary">
          <i class="bi bi-mortarboard me-2"></i>ELearning Platform
        </span>
        <span *ngIf="exam" class="text-muted small">
          {{ exam.studentName }} — {{ exam.studentEmail }}
        </span>
      </nav>

      <!-- Session interrompue : blocage total de l'interface -->
      <div *ngIf="status === 'terminated'"
           class="d-flex align-items-center justify-content-center p-4"
           style="position:fixed;inset:0;background:rgba(20,20,30,.96);z-index:3000;pointer-events:all">
        <div class="card border-0 shadow text-center p-5" style="max-width:500px">
          <i class="bi bi-shield-exclamation text-danger" style="font-size:3.5rem"></i>
          <h3 class="mt-3 text-danger fw-bold">Session interrompue</h3>
          <p class="text-muted mt-2">{{ terminationReason }}</p>
          <p class="text-muted mt-2">
            Vos réponses ont été automatiquement soumises dans leur état actuel.<br>
            Vous recevrez vos résultats détaillés par email <strong>dans {{ delayLabel }}</strong>.
          </p>
          <p class="text-muted small mt-3 mb-0">
            Cet examen est terminé. Vous ne pouvez plus interagir avec cette page.
          </p>
        </div>
      </div>

      <!-- Verrouillage plein écran -->
      <div *ngIf="status === 'active' && fullscreenWarning"
           class="d-flex flex-column align-items-center justify-content-center text-center p-4"
           style="position:fixed;inset:0;background:rgba(20,20,30,.92);z-index:2000;color:#fff">
        <i class="bi bi-arrows-fullscreen" style="font-size:3rem"></i>
        <h4 class="mt-3 fw-bold">Mode plein écran requis</h4>
        <p class="text-light-50 mb-2" style="max-width:480px">
          L'examen doit être passé en plein écran. Vous avez quitté ce mode : 
          <strong>Tentative {{ fullscreenExitCount }}/3</strong>
        </p>
        <p class="text-light-50 mb-4" style="max-width:480px">
          Vous avez <strong>{{ fullscreenRemainingTime }} secondes</strong> pour revenir en plein écran,
          sinon votre session sera automatiquement interrompue.
        </p>
        <button class="btn btn-primary btn-lg" (click)="resumeFullscreen()">
          <i class="bi bi-arrows-fullscreen me-2"></i>Revenir en plein écran
        </button>
        <p class="text-danger small mt-3" *ngIf="fullscreenExitCount >= 3">
          Après la 3ème tentative, l'examen sera automatiquement soumis et fermé.
        </p>
      </div>

      <!-- Widget de surveillance (caméra + micro) -->
      <div *ngIf="status === 'active'" class="proctor-widget">
        <div class="proctor-video-wrap">
          <video #proctorVideo class="proctor-video" autoplay muted playsinline></video>
          <span class="proctor-rec"><span class="proctor-rec-dot"></span>REC</span>
        </div>
        <div class="proctor-info">
          <div class="small fw-semibold text-white"><i class="bi bi-eye-fill me-1"></i>Surveillance active</div>
          <div class="small text-light">Nous voyons vos gestes et entendons votre voix.</div>
          <div class="proctor-mic mt-1">
            <i class="bi bi-mic-fill text-white"></i>
            <div class="proctor-mic-bar"><div class="proctor-mic-fill" [style.width.%]="micLevel"></div></div>
          </div>
        </div>
      </div>

      <div *ngIf="status === 'active' && cameraError" class="alert alert-danger small d-flex align-items-center gap-2"
           style="position:fixed;bottom:1rem;left:1rem;right:220px;max-width:480px;z-index:2100">
        <i class="bi bi-camera-video-off"></i>{{ cameraError }}
      </div>

      <div class="flex-grow-1 d-flex p-3"
           style="min-height:0"
           [class.align-items-center]="status !== 'active'"
           [class.justify-content-center]="status !== 'active'"
           [class.overflow-hidden]="status === 'active'">

        <!-- Chargement -->
        <div *ngIf="status === 'loading'" class="text-center">
          <div class="spinner-border text-primary mb-3"></div>
          <p class="text-muted">Chargement de l'examen...</p>
        </div>

        <!-- Erreur -->
        <div *ngIf="status === 'error'" class="card border-0 shadow text-center p-5" style="max-width:500px">
          <i class="bi bi-exclamation-triangle text-danger" style="font-size:3rem"></i>
          <h4 class="mt-3">Accès refusé</h4>
          <p class="text-muted">{{ errorMessage }}</p>
        </div>

        <!-- Déjà soumis -->
        <div *ngIf="status === 'already-submitted'" class="card border-0 shadow text-center p-5" style="max-width:500px">
          <i class="bi bi-check-circle text-success" style="font-size:3rem"></i>
          <h4 class="mt-3 text-success">Examen déjà soumis</h4>
          <p class="text-muted">Vous avez déjà soumis cet examen. Vos résultats vous seront envoyés par email {{ delayLabel }} après votre soumission.</p>
        </div>

        <!-- Exclu pour violations anti-triche : accès bloqué jusqu'à la fin du temps estimé -->
        <div *ngIf="status === 'blocked'" class="card border-0 shadow text-center p-5" style="max-width:500px">
          <i class="bi bi-shield-lock text-danger" style="font-size:3rem"></i>
          <h4 class="mt-3 text-danger">Accès temporairement bloqué</h4>
          <p class="text-muted">
            Vous avez été exclu(e) de cet examen pour non-respect des règles anti-triche.
            Votre résultat et l'accès à votre compte seront disponibles à partir du
            <strong>{{ resultsAvailableAt }}</strong>.
          </p>
        </div>

        <!-- Bienvenue -->
        <div *ngIf="status === 'welcome' && exam" class="card border-0 shadow p-5 text-center" style="max-width:600px;width:100%">
          <i class="bi bi-clipboard-check text-primary" style="font-size:3.5rem"></i>
          <h3 class="mt-3 fw-bold">{{ exam.examTitle }}</h3>
          <p class="text-muted mb-4">{{ exam.examDescription }}</p>
          <div class="alert alert-light border text-start mb-4">
            <p class="mb-1"><strong>Étudiant :</strong> {{ exam.studentName }}</p>
            <p class="mb-1"><strong>Email :</strong> {{ exam.studentEmail }}</p>
            <p class="mb-0"><strong>Nombre de questions :</strong> {{ exam.questions.length }}</p>
          </div>
          <div class="alert alert-warning small text-start">
            <i class="bi bi-exclamation-triangle me-1"></i>
            Lisez attentivement chaque question. Une fois soumis, vous ne pourrez pas modifier vos réponses.
            Vos résultats vous seront envoyés par email <strong>{{ delayLabel }} après la soumission</strong>.
          </div>
          <div class="alert alert-danger small text-start">
            <i class="bi bi-shield-exclamation me-1"></i>
            <strong><i class="bi bi-exclamation-triangle me-1"></i>Règles du mode plein écran :</strong> Vous ne pouvez quitter le plein écran que <strong>2 fois maximum</strong>. 
            À la <strong>3ème sortie, vous serez immédiatement exclu de l'examen</strong> et vos réponses seront soumises automatiquement. 
            <strong>Vous ne pourrez pas vous reconnecter tant que la session d'examen ne sera pas terminée.</strong>
          </div>
          <div class="alert alert-info small text-start">
            <i class="bi bi-shield-lock me-1"></i>
            L'examen démarre en mode plein écran. Le copier/coller et le clic droit sont désactivés
            pendant toute la durée de l'épreuve.
          </div>
          <button class="btn btn-primary btn-lg mt-2" (click)="startExam()" [disabled]="starting">
            <span *ngIf="starting" class="spinner-border spinner-border-sm me-2"></span>
            <i *ngIf="!starting" class="bi bi-play-circle me-2"></i>
            Commencer l'examen
          </button>
        </div>

        <!-- Examen actif -->
        <div *ngIf="status === 'active' && exam" class="pe-2 exam-fullscreen-content" style="width:100%;height:100%;min-height:0;overflow-y:auto">
          <div *ngIf="tabSwitchWarnings > 0" class="alert alert-warning small d-flex align-items-center gap-2 mb-3">
            <i class="bi bi-exclamation-triangle-fill"></i>
            <span>
              Changement de fenêtre/onglet détecté ({{ tabSwitchWarnings }}). Restez sur cette page pendant l'examen.
            </span>
          </div>

          <div *ngIf="voiceWarningActive" class="alert alert-danger small d-flex align-items-center gap-2 mb-3">
            <i class="bi bi-volume-up-fill"></i>
            <span>
              Niveau sonore trop élevé détecté. Merci de rester silencieux. Votre session sera arrêtée automatiquement
              dans <strong>{{ voiceWarningRemaining }}</strong> seconde(s) si le bruit persiste.
            </span>
          </div>

          <div class="d-flex justify-content-between align-items-center mb-4">
            <h4 class="fw-bold mb-0">{{ exam.examTitle }}</h4>
            <span class="badge bg-success">{{ answeredCount }}/{{ exam.questions.length }} réponses</span>
          </div>

          <div *ngFor="let q of exam.questions; let i = index" class="card border-0 shadow-sm mb-4">
            <div class="card-header bg-primary text-white py-2 px-3 d-flex justify-content-between">
              <span>Question {{ q.orderIndex }}</span>
              <span>{{ q.maxScore }} pts</span>
            </div>
            <div class="card-body">
              <p class="fw-semibold mb-3" style="white-space:pre-wrap">{{ getInstructionText(q) }}</p>

              <div *ngIf="isCodeQuestion(q)" class="mini-ide mb-3">
                <div class="mini-ide-header">
                  <span class="mini-ide-dot bg-danger"></span>
                  <span class="mini-ide-dot bg-warning"></span>
                  <span class="mini-ide-dot bg-success"></span>
                  <span class="ms-2 small text-light">Main.java</span>
                </div>
                <div class="mini-ide-body">
                  <div class="mini-ide-gutter">
                    <div *ngFor="let n of range(getLineCount(getCodeSnippet(q)))">{{ n }}</div>
                  </div>
                  <pre class="mini-ide-code"><code>{{ getCodeSnippet(q) }}</code></pre>
                </div>
              </div>

              <label class="form-label small text-muted">Votre réponse</label>

              <div *ngIf="isCodeQuestion(q)" class="mini-ide">
                <div class="mini-ide-header">
                  <span class="mini-ide-dot bg-danger"></span>
                  <span class="mini-ide-dot bg-warning"></span>
                  <span class="mini-ide-dot bg-success"></span>
                  <span class="ms-2 small text-light">Votre code</span>
                </div>
                <div class="mini-ide-body">
                  <div class="mini-ide-gutter">
                    <div *ngFor="let n of range(getLineCount(answers[q.id], 8))">{{ n }}</div>
                  </div>
                  <textarea class="mini-ide-textarea" [(ngModel)]="answers[q.id]" rows="8" spellcheck="false"
                            placeholder="Écrivez votre code ici..."
                            (scroll)="syncGutterScroll($event)"
                            (keydown)="onCodeKeydown($event)"></textarea>
                </div>
              </div>

              <textarea *ngIf="!isCodeQuestion(q)" class="form-control" [(ngModel)]="answers[q.id]" rows="4"
                        placeholder="Votre réponse ici..."></textarea>
            </div>
          </div>

          <div class="card border-0 shadow-sm p-4 text-center">
            <p class="text-muted mb-3">
              Vous avez répondu à {{ answeredCount }} question(s) sur {{ exam.questions.length }}.
            </p>
            <button class="btn btn-success btn-lg" (click)="submitExam()" [disabled]="submitting">
              <span *ngIf="submitting" class="spinner-border spinner-border-sm me-2"></span>
              <i *ngIf="!submitting" class="bi bi-send me-2"></i>
              Soumettre mes réponses
            </button>
          </div>
        </div>

        <!-- Soumis avec succès -->
        <div *ngIf="status === 'submitted'" class="card border-0 shadow text-center p-5" style="max-width:500px">
          <i class="bi bi-send-check text-success" style="font-size:3.5rem"></i>
          <h3 class="mt-3 text-success fw-bold">Examen soumis !</h3>
          <p class="text-muted mt-2">
            Vos réponses ont été enregistrées avec succès.<br>
            Vous recevrez vos résultats détaillés par email <strong>dans {{ delayLabel }}</strong>.
          </p>
          <div class="alert alert-info small mt-3">
            <i class="bi bi-info-circle me-1"></i>
            Un agent IA corrigera vos réponses et générera un rapport personnalisé envoyé à {{ exam?.studentEmail }}.
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .proctor-widget {
      position: fixed;
      bottom: 1rem;
      right: 1rem;
      width: 200px;
      background: #1e1e1e;
      border-radius: 10px;
      box-shadow: 0 4px 18px rgba(0,0,0,.35);
      overflow: hidden;
      z-index: 2050;
    }
    .proctor-video-wrap { position: relative; background:#000; }
    .proctor-video { width: 100%; height: 110px; object-fit: cover; display: block; background:#000; }
    .proctor-rec {
      position: absolute; top: 6px; right: 6px;
      background: rgba(0,0,0,.55); color:#fff; font-size: .65rem;
      padding: 2px 6px; border-radius: 4px; display:flex; align-items:center; gap:4px;
    }
    .proctor-rec-dot {
      width: 8px; height: 8px; border-radius: 50%; background: #ff4d4f;
      animation: proctor-blink 1.2s infinite;
    }
    @keyframes proctor-blink { 0%, 100% { opacity: 1; } 50% { opacity: .2; } }
    .proctor-info { padding: 8px 10px; }
    .proctor-mic { display:flex; align-items:center; gap:6px; }
    .proctor-mic-bar { flex:1; height:6px; background:#3a3a3a; border-radius:3px; overflow:hidden; }
    .proctor-mic-fill { height:100%; background:#27c93f; transition: width .08s linear; }

    .mini-ide { border-radius: 8px; overflow: hidden; border: 1px solid #2d2d2d; background:#1e1e1e; }
    .mini-ide-header { background:#2d2d2d; padding: 6px 10px; display:flex; align-items:center; gap:6px; }
    .mini-ide-dot { width:10px; height:10px; border-radius:50%; display:inline-block; }
    .mini-ide-body { display:flex; align-items:stretch; }
    .mini-ide-gutter {
      background:#252526; color:#6e7681; text-align:right; padding:10px 8px;
      font-family:'Courier New',monospace; font-size:.85rem; line-height:1.5;
      user-select:none; overflow:hidden;
    }
    .mini-ide-code, .mini-ide-textarea {
      flex:1; margin:0; padding:10px; font-family:'Courier New',monospace; font-size:.85rem;
      line-height:1.5; color:#d4d4d4; background:#1e1e1e; border:none; white-space:pre;
      overflow:auto; min-width:0;
    }
    .mini-ide-textarea { resize:none; outline:none; }
    .mini-ide-textarea:focus { box-shadow:none; }
  `]
})
export class ExamTakeComponent implements OnInit, OnDestroy {
  status: PageStatus = 'loading';
  exam: ExamTakeResponse | null = null;
  answers: { [questionId: number]: string } = {};
  errorMessage = '';
  starting = false;
  submitting = false;
  token = '';

  fullscreenWarning = false;
  fullscreenExitCount = 0;
  fullscreenRemainingTime = 0;
  tabSwitchWarnings = 0;
  terminationReason = '';
  resultsAvailableAt = '';

  micLevel = 0;
  cameraError = '';
  voiceWarningActive = false;
  voiceWarningRemaining = 0;

  private readonly FULLSCREEN_GRACE_PERIODS = [30000, 15000, 5000]; // 30s, 15s, 5s
  private readonly VOICE_THRESHOLD = 55;
  private readonly VOICE_WARNING_MS = 60000;

  private originalWindowOpen = window.open;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micRafId: number | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private fullscreenExitTimer: ReturnType<typeof setTimeout> | null = null;
  private fullscreenCountdownInterval: ReturnType<typeof setInterval> | null = null;
  private voiceWarningEndAt = 0;

  @ViewChild('proctorVideo') set proctorVideo(ref: ElementRef<HTMLVideoElement> | undefined) {
    this.videoElement = ref?.nativeElement || null;
    this.attachStreamToVideo();
  }

  constructor(private dialogs: DialogService, 
    private route: ActivatedRoute,
    private examService: ExamService,
    private uiChrome: UiChromeService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    const storedReason = this.getStoredTerminationReason();

    this.examService.getExamByToken(this.token).subscribe({
      next: r => {
        this.exam = r.data;
        if (this.exam.resultsLocked) {
          this.resultsAvailableAt = this.exam.resultsAvailableAt
            ? new Date(this.exam.resultsAvailableAt).toLocaleString('fr-FR')
            : '';
          this.status = 'blocked';
        } else if (storedReason) {
          this.terminationReason = storedReason;
          this.status = 'terminated';
        } else if (this.exam.status === 'SUBMITTED' || this.exam.status === 'GRADED') {
          this.status = 'already-submitted';
        } else if (this.exam.status === 'STARTED') {
          this.status = 'active';
          this.uiChrome.hide();
        } else {
          this.status = 'welcome';
        }
      },
      error: e => {
        this.status = 'error';
        this.errorMessage = e?.error?.message || 'Token d\'accès invalide ou examen non disponible.';
      }
    });
  }

  // --- Persistance du blocage de session (anti-cheat) ---

  private terminationStorageKey(): string {
    return `exam-terminated-${this.token}`;
  }

  private getStoredTerminationReason(): string | null {
    try {
      return localStorage.getItem(this.terminationStorageKey());
    } catch {
      return null;
    }
  }

  private storeTerminationReason(reason: string) {
    try {
      localStorage.setItem(this.terminationStorageKey(), reason);
    } catch {}
  }

  get answeredCount(): number {
    return Object.values(this.answers).filter(a => a?.trim()).length;
  }

  get delayLabel(): string {
    const minutes = this.exam?.gradingDelayMinutes ?? 60;
    if (minutes >= 60 && minutes % 60 === 0) {
      const hours = minutes / 60;
      return hours === 1 ? '1 heure' : `${hours} heures`;
    }
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }

  startExam() {
    // Le navigateur n'autorise requestFullscreen que dans le geste utilisateur.
    this.enterFullscreen();
    this.starting = true;
    this.examService.startExam(this.token).subscribe({
      next: r => {
        this.exam = r.data;
        this.status = 'active';
        this.starting = false;
        this.uiChrome.hide();
        this.lockDown();
        this.lockScroll();
        this.enableProctoring();
      },
      error: () => this.starting = false
    });
  }

  // --- Anti-cheat: blocage du défilement de la page ---

  private lockScroll() {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }

  private unlockScroll() {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }

  // --- Surveillance: caméra + micro ---

  private async enableProctoring() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      this.attachStreamToVideo();
      this.startMicMeter();
    } catch {
      this.cameraError = "Impossible d'activer la caméra/micro. La surveillance vidéo de l'examen est désactivée.";
    }
  }

  private attachStreamToVideo() {
    if (this.videoElement && this.mediaStream) {
      this.videoElement.srcObject = this.mediaStream;
      this.videoElement.play().catch(() => {});
    }
  }

  private startMicMeter() {
    if (!this.mediaStream) return;
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);

    const data = new Uint8Array(this.analyser.frequencyBinCount);
    const tick = () => {
      if (!this.analyser) return;
      this.analyser.getByteFrequencyData(data);
      const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
      this.micLevel = Math.min(100, Math.round((avg / 128) * 100));
      this.checkVoiceLevel();
      this.micRafId = requestAnimationFrame(tick);
    };
    tick();
  }

  private checkVoiceLevel() {
    if (this.status !== 'active') return;

    if (this.micLevel >= this.VOICE_THRESHOLD) {
      if (!this.voiceWarningActive) {
        this.voiceWarningActive = true;
        this.voiceWarningEndAt = Date.now() + this.VOICE_WARNING_MS;
      }
      this.voiceWarningRemaining = Math.max(0, Math.ceil((this.voiceWarningEndAt - Date.now()) / 1000));
      if (Date.now() >= this.voiceWarningEndAt) {
        this.terminateSession('Un niveau sonore élevé a été détecté de manière prolongée et vous avez été averti(e), '
          + 'mais le bruit n\'a pas cessé.');
      }
    } else if (this.voiceWarningActive) {
      this.voiceWarningActive = false;
      this.voiceWarningRemaining = 0;
    }
  }

  private stopProctoring() {
    if (this.micRafId !== null) {
      cancelAnimationFrame(this.micRafId);
      this.micRafId = null;
    }
    this.analyser = null;
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    this.micLevel = 0;
  }

  // --- Anti-cheat: plein écran ---

  private enterFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {});
    }
  }

  resumeFullscreen() {
    this.enterFullscreen();
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange() {
    if (this.status !== 'active') return;

    const isFullscreen = !!document.fullscreenElement;

    if (!isFullscreen && !this.fullscreenWarning) {
      // Sortie du fullscreen détectée
      this.fullscreenExitCount++;
      this.fullscreenWarning = true;

      if (this.fullscreenExitCount >= 3) {
        // 3ème sortie: interruption immédiate
        this.recordFullscreenViolation(this.fullscreenExitCount, false);
        this.fullscreenRemainingTime = 0;
        setTimeout(() => {
          this.terminateSession('Vous avez quitté le mode plein écran trois fois. L\'examen a été interrompu.');
        }, 500);
      } else {
        // 1ère ou 2ème sortie: envoyer la violation et utiliser la période de grâce
        this.recordFullscreenViolation(this.fullscreenExitCount, true);
        const gracePeriod = this.FULLSCREEN_GRACE_PERIODS[this.fullscreenExitCount - 1];
        this.startFullscreenCountdown(gracePeriod);
      }
    } else if (isFullscreen && this.fullscreenWarning) {
      // Retour au fullscreen
      this.fullscreenWarning = false;
      this.fullscreenRemainingTime = 0;
      this.clearCountdownInterval();
    }
  }

  private startFullscreenCountdown(gracePeriodMs: number) {
    this.clearCountdownInterval();
    const startTime = Date.now();
    const endTime = startTime + gracePeriodMs;

    this.fullscreenCountdownInterval = setInterval(() => {
      const remaining = Math.max(0, endTime - Date.now());
      this.fullscreenRemainingTime = Math.ceil(remaining / 1000);

      if (remaining <= 0) {
        this.clearCountdownInterval();
        if (this.status === 'active' && this.fullscreenWarning) {
          this.terminateSession(`Vous avez quitté le mode plein écran pendant plus de ${gracePeriodMs / 1000} secondes.`);
        }
      }
    }, 100);
  }

  private clearCountdownInterval() {
    if (this.fullscreenCountdownInterval) {
      clearInterval(this.fullscreenCountdownInterval);
      this.fullscreenCountdownInterval = null;
    }
  }

  private recordFullscreenViolation(violationNumber: number, shouldContinue: boolean) {
    if (!this.exam) return;
    this.examService.recordFullscreenViolation(this.token, {
      violationNumber,
      details: `Sortie du plein écran - Tentative ${violationNumber}/3`,
      shouldTerminate: !shouldContinue
    }).subscribe({
      next: () => {},
      error: (err) => {
        console.error('Erreur lors de l\'enregistrement de la violation:', err);
      }
    });
  }

  // --- Anti-cheat: changement d'onglet/fenêtre ---

  @HostListener('document:visibilitychange')
  onVisibilityChange() {
    if (this.status === 'active' && document.hidden) {
      this.tabSwitchWarnings++;
    }
  }

  // --- Anti-cheat: copier / couper / coller / clic droit ---

  @HostListener('document:copy', ['$event'])
  @HostListener('document:cut', ['$event'])
  @HostListener('document:paste', ['$event'])
  blockClipboard(event: ClipboardEvent) {
    if (this.status === 'active' || this.status === 'terminated') {
      event.preventDefault();
    }
  }

  @HostListener('document:contextmenu', ['$event'])
  blockContextMenu(event: MouseEvent) {
    if (this.status === 'active' || this.status === 'terminated') {
      event.preventDefault();
    }
  }

  // --- Anti-cheat: empêcher la fermeture/quitter la page ---

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent) {
    if (this.status === 'active') {
      event.preventDefault();
      event.returnValue = true;
    }
  }

  private lockDown() {
    window.open = () => null;
  }

  private unlock() {
    window.open = this.originalWindowOpen;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    if (this.fullscreenExitTimer !== null) {
      clearTimeout(this.fullscreenExitTimer);
      this.fullscreenExitTimer = null;
    }
    this.clearCountdownInterval();
    this.fullscreenWarning = false;
    this.fullscreenRemainingTime = 0;
    this.voiceWarningActive = false;
    this.voiceWarningRemaining = 0;
    this.unlockScroll();
    this.stopProctoring();
    this.uiChrome.show();
  }

  ngOnDestroy() {
    this.unlock();
  }

  // --- Affichage des questions de code dans une petite IDE ---

  private readonly codeIndicators = /[{};]|^\s*(public|private|protected|class|void|int|double|String|return|import|package|def|function|for|while|if)\b/;

  isCodeQuestion(q: ExamQuestion): boolean {
    return this.getCodeSnippet(q).length > 0;
  }

  getInstructionText(q: ExamQuestion): string {
    return this.splitQuestion(q.questionText).text;
  }

  getCodeSnippet(q: ExamQuestion): string {
    return this.splitQuestion(q.questionText).code;
  }

  private splitQuestion(questionText: string): { text: string; code: string } {
    const paragraphs = questionText.split(/\n\s*\n/);
    const textParts: string[] = [];
    const codeParts: string[] = [];

    for (const para of paragraphs) {
      const lines = para.split('\n');
      const codeLines = lines.filter(l => this.codeIndicators.test(l)).length;
      if (lines.length > 1 && codeLines / lines.length >= 0.4) {
        codeParts.push(para);
      } else {
        textParts.push(para);
      }
    }

    return { text: textParts.join('\n\n').trim(), code: codeParts.join('\n\n').trim() };
  }

  getLineCount(text: string | undefined, min = 1): number {
    const lines = (text || '').split('\n').length;
    return Math.max(lines, min);
  }

  range(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i + 1);
  }

  syncGutterScroll(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    const gutter = textarea.parentElement?.querySelector('.mini-ide-gutter') as HTMLElement | null;
    if (gutter) gutter.scrollTop = textarea.scrollTop;
  }

  onCodeKeydown(event: KeyboardEvent) {
    if (event.key === 'Tab') {
      event.preventDefault();
      const ta = event.target as HTMLTextAreaElement;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const value = ta.value;
      ta.value = value.substring(0, start) + '    ' + value.substring(end);
      ta.selectionStart = ta.selectionEnd = start + 4;
      ta.dispatchEvent(new Event('input'));
    }
  }

  private buildAnswers(): StudentAnswer[] {
    if (!this.exam) return [];
    return this.exam.questions.map(q => ({
      questionId: q.id,
      answer: this.answers[q.id] || ''
    }));
  }

  async submitExam() {
    if (!this.exam) return;
    if (!(await this.dialogs.confirm({ title: 'Soumettre l’examen ?', message: 'Vos réponses seront enregistrées et vous serez déconnecté(e) de la plateforme.', icon: 'bi-send-check', confirmText: 'Soumettre' }))) return;

    this.submitting = true;
    this.examService.submitExam(this.token, { answers: this.buildAnswers() }).subscribe({
      next: () => {
        this.status = 'submitted';
        this.submitting = false;
        this.unlock();
        this.authService.logout();
      },
      error: e => {
        this.dialogs.alert({ title: 'Soumission impossible', message: e?.error?.message || 'Erreur lors de la soumission. Veuillez réessayer.', tone: 'danger' });
        this.submitting = false;
      }
    });
  }

  // --- Arrêt forcé de la session (anti-cheat) ---

  private terminateSession(reason: string) {
    if (this.status !== 'active' || !this.exam) return;

    this.terminationReason = reason;
    this.status = 'terminated';
    this.storeTerminationReason(reason);
    this.unlock();

    this.examService.submitExam(this.token, { answers: this.buildAnswers() }).subscribe({
      next: () => {},
      error: () => {}
    });
  }
}
