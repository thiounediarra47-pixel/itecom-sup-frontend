import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { safeReturnUrl } from '../../../core/guards/auth.guard';
import { DialogService } from '../../../core/services/dialog.service';
import { ForgotPasswordDialogComponent } from './forgot-password-dialog.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="landing">
      <!-- Fond dessiné (sans image) -->
      <div class="bg" aria-hidden="true">
        <span class="glow glow-1"></span><span class="glow glow-2"></span><span class="glow glow-3"></span>
        <span class="grid"></span>
      </div>
      <div class="shade" aria-hidden="true"></div>

      <div class="content">
        <!-- Barre du haut -->
        <header class="topbar container-xl">
          <a class="brand" href="/" aria-label="ITECOM, accueil">
            <span class="brand-mark"><i class="bi bi-mortarboard-fill"></i></span>
            <span class="brand-name"><span class="ite">ITE</span><span class="com">COM</span></span>
          </a>
          <nav class="d-none d-md-flex topnav" aria-label="Liens">
            <button type="button" class="link-btn" (click)="openAbout()"><i class="bi bi-info-circle me-1"></i>À propos</button>
            <button type="button" class="link-btn" (click)="openForgot()"><i class="bi bi-key me-1"></i>Mot de passe oublié</button>
          </nav>
        </header>

        <main class="hero container-xl">
          <div class="hero-copy">
            <span class="eyebrow"><i class="bi bi-stars me-1"></i>Plateforme d'apprentissage en ligne</span>
            <h1>Apprenez, pratiquez <span class="accent">et réussissez</span> avec ITECOM.</h1>
            <p class="lead-text">
              Cours en ligne, cas pratiques et examens corrigés automatiquement, avec le suivi de vos résultats
              et l'accompagnement de vos enseignants.
            </p>
            <div class="subject-list" aria-label="Matières enseignées">
              <button *ngFor="let s of subjects" type="button" class="subject" [style.--c]="s.color" (click)="openSubject(s)">
                <i class="bi" [ngClass]="s.icon"></i><span>{{ s.name }}</span>
              </button>
            </div>
          </div>

          <!-- Formulaire de connexion flottant -->
          <div id="connexion" class="login-card">
            <div class="login-head">
              <h2>Connexion</h2>
              <span><i class="bi bi-shield-lock me-1"></i>Espace sécurisé</span>
            </div>
            <div *ngIf="sessionReplaced" class="alert alert-warning d-flex gap-2 py-2 px-3 small mb-3" role="alert">
              <i class="bi bi-person-lock mt-1"></i>
              <span>Votre compte a été ouvert sur un autre appareil : vous avez été déconnecté.
                Un compte ne peut être connecté qu'à un seul endroit à la fois.</span>
            </div>
            <div *ngIf="!online" class="alert alert-warning d-flex gap-2 py-2 px-3 small mb-3" role="status">
              <i class="bi bi-wifi-off mt-1"></i>
              <span>Hors connexion : connectez-vous avec le même email et mot de passe que la dernière fois sur cet appareil.
                Vos cours et votre progression sont disponibles ; tout sera envoyé au retour d'internet.</span>
            </div>
            <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
              <label class="visually-hidden" for="loginEmail">Adresse email</label>
              <div class="field" [class.invalid]="form.get('email')?.invalid && form.get('email')?.touched">
                <i class="bi bi-envelope"></i>
                <input id="loginEmail" type="email" formControlName="email" placeholder="Adresse email" autocomplete="username">
              </div>
              <label class="visually-hidden" for="loginPassword">Mot de passe</label>
              <div class="field mt-2" [class.invalid]="form.get('password')?.invalid && form.get('password')?.touched">
                <i class="bi bi-lock"></i>
                <input id="loginPassword" [type]="showPassword ? 'text' : 'password'" formControlName="password"
                       placeholder="Mot de passe" autocomplete="current-password">
                <button type="button" class="eye" (click)="showPassword = !showPassword"
                        [attr.aria-label]="showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'">
                  <i class="bi" [class.bi-eye]="!showPassword" [class.bi-eye-slash]="showPassword"></i>
                </button>
              </div>

              <div class="alert alert-danger d-flex align-items-center gap-2 py-2 px-3 small mt-2 mb-0" *ngIf="error" role="alert">
                <i class="bi bi-exclamation-triangle-fill"></i> {{ error }}
              </div>

              <button type="submit" class="btn btn-login w-100 mt-3" [disabled]="loading">
                <span *ngIf="loading" class="spinner-border spinner-border-sm me-2"></span>
                {{ loading ? 'Connexion…' : 'Se connecter' }}
                <i *ngIf="!loading" class="bi bi-arrow-right ms-2"></i>
              </button>
              <div class="login-foot">
                <button type="button" class="link-inline" (click)="openForgot()">Mot de passe oublié ?</button>
                <span>Comptes créés par l'administration</span>
              </div>
            </form>
          </div>
        </main>

        <!-- Les quatre atouts, posés sur la bannière -->
        <section class="features container-xl" aria-label="La plateforme">
          <button type="button" class="feature" *ngFor="let f of features" (click)="openFeature(f)">
            <span class="feature-icon"><i class="bi" [ngClass]="f.icon"></i></span>
            <div>
              <h3>{{ f.title }}</h3>
              <p>{{ f.text }}</p>
            </div>
            <i class="bi bi-arrow-up-right feature-go"></i>
          </button>
        </section>

        <footer class="footer container-xl">
          <span>© {{ year }} ITECOM — Plateforme d'apprentissage en ligne</span>
          <span><i class="bi bi-shield-lock me-1"></i>Connexion sécurisée</span>
        </footer>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .landing {
      --navy: #0b2a6f; --blue: #2b3ea8;
      position: relative; min-height: 100vh; overflow: hidden; color: #fff;
      background: #06163d; font-family: 'Inter', sans-serif;
    }

    /* Fond dessiné : dégradé, halos lumineux et trame légère */
    .bg { position: absolute; inset: 0; overflow: hidden;
      background: radial-gradient(120% 90% at 80% 0%, #123a8c 0%, #0b2a6f 42%, #06163d 100%); }
    .glow { position: absolute; border-radius: 50%; filter: blur(80px); opacity: .55; animation: drift 18s ease-in-out infinite alternate; }
    .glow-1 { width: 520px; height: 520px; background: #2b3ea8; top: -140px; right: 8%; }
    .glow-2 { width: 420px; height: 420px; background: #06b6d4; bottom: -160px; left: 18%; opacity: .35; animation-delay: -6s; }
    .glow-3 { width: 360px; height: 360px; background: #2b3ea8; top: 35%; left: -120px; opacity: .35; animation-delay: -12s; }
    .grid { position: absolute; inset: 0; opacity: .12;
      background-image: linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px);
      background-size: 56px 56px; mask-image: radial-gradient(ellipse at 60% 40%, #000 20%, transparent 75%); }
    .shade { display: none; }
    .content { position: relative; z-index: 1; min-height: 100vh; display: flex; flex-direction: column; }

    /* Barre du haut */
    .topbar { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding-top: 20px; padding-bottom: 12px; }
    .brand { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; }
    .brand-mark {
      width: 40px; height: 40px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #2b3ea8, var(--blue)); color: #fff; font-size: 1.2rem;
      box-shadow: 0 6px 16px rgba(43, 62, 168, .45);
    }
    .brand-name { font-size: 1.5rem; font-weight: 800; letter-spacing: .02em; }
    .brand-name .ite { color: #fff; }
    .brand-name .com { color: #5567cc; }
    .topnav { gap: 8px; }
    .link-btn { border: 0; background: transparent; color: rgba(255, 255, 255, .82); font-weight: 500; font-size: .9rem; padding: 6px 10px; border-radius: 10px; }
    .link-btn:hover { color: #fff; background: rgba(255, 255, 255, .1); }
    .link-inline { border: 0; background: none; padding: 0; color: var(--blue); font-weight: 600; font-size: .78rem; }
    .link-inline:hover { text-decoration: underline; }

    /* Bannière */
    .hero {
      flex: 1; display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 48px; align-items: center;
      padding-top: 24px; padding-bottom: 24px;
    }
    .eyebrow {
      display: inline-flex; align-items: center; padding: 6px 12px; border-radius: 999px; font-size: .8rem; font-weight: 600;
      background: rgba(96, 165, 250, .18); color: #eef0fb; border: 1px solid rgba(147, 197, 253, .35);
      backdrop-filter: blur(6px);
    }
    .hero h1 {
      font-size: clamp(2rem, 3.8vw, 3.3rem); font-weight: 800; line-height: 1.1; margin: 18px 0 14px;
      letter-spacing: -.01em; max-width: 640px; text-shadow: 0 2px 18px rgba(0, 0, 0, .35);
    }
    .hero h1 .accent { background: linear-gradient(90deg, #5567cc, #a5f3fc); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .lead-text { color: rgba(241, 245, 249, .9); font-size: 1.05rem; line-height: 1.6; max-width: 520px; margin-bottom: 22px; text-shadow: 0 1px 10px rgba(0, 0, 0, .3); }
    .subject-list { display: flex; flex-wrap: wrap; gap: 8px; max-width: 600px; }
    .subject {
      display: inline-flex; align-items: center; gap: 7px; padding: 7px 13px; border-radius: 999px; font-size: .82rem; font-weight: 600;
      color: #fff; background: rgba(15, 23, 42, .35); border: 1px solid rgba(255, 255, 255, .25);
      backdrop-filter: blur(8px); transition: background .25s, border-color .25s, transform .15s;
    }
    .subject:hover { background: rgba(255, 255, 255, .18); transform: translateY(-1px); }
    .subject:hover { border-color: var(--c); }
    .subject i { color: var(--c); filter: brightness(1.5); }

    /* Connexion flottante (verre dépoli) */
    .login-card {
      padding: 22px 22px 16px; border-radius: 20px; color: #0f172a;
      background: rgba(255, 255, 255, .88); backdrop-filter: blur(18px) saturate(160%); -webkit-backdrop-filter: blur(18px) saturate(160%);
      border: 1px solid rgba(255, 255, 255, .7); box-shadow: 0 30px 60px rgba(2, 8, 30, .45);
      animation: rise .6s .1s cubic-bezier(.2, .8, .2, 1) both;
    }
    .login-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 14px; }
    .login-head h2 { font-size: 1.2rem; font-weight: 800; margin: 0; }
    .login-head span { font-size: .75rem; color: #64748b; }
    .field {
      display: flex; align-items: center; gap: 10px; height: 46px; padding: 0 12px; border-radius: 12px;
      border: 1.5px solid #dbe3f0; background: var(--surface); transition: border-color .2s, box-shadow .2s;
    }
    .field:focus-within { border-color: var(--blue); box-shadow: 0 0 0 4px rgba(43, 62, 168, .14); }
    .field.invalid { border-color: #dc3545; }
    .field > i { color: #94a3b8; }
    .field input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; font-size: .95rem; color: #0f172a; }
    .field .eye { border: 0; background: transparent; color: #64748b; padding: 4px; }
    .field .eye:hover { color: var(--blue); }
    .btn-login {
      height: 46px; border: 0; border-radius: 12px; font-weight: 700; color: #fff;
      background: linear-gradient(135deg, var(--navy), var(--blue)); box-shadow: 0 10px 22px rgba(43, 62, 168, .35);
      transition: transform .15s, box-shadow .2s;
    }
    .btn-login:hover:not(:disabled) { color: #fff; transform: translateY(-1px); box-shadow: 0 14px 28px rgba(43, 62, 168, .45); }
    .btn-login:disabled { color: #fff; opacity: .85; }
    .login-foot { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-top: 10px; font-size: .78rem; }
    .login-foot a { color: var(--blue); font-weight: 600; text-decoration: none; }
    .login-foot a:hover { text-decoration: underline; }
    .login-foot span { color: #64748b; }

    /* Les quatre atouts sur la bannière */
    .features { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; padding-bottom: 14px; }
    .feature {
      position: relative; text-align: left; color: #fff; width: 100%; cursor: pointer;
      transition: transform .15s, background .2s;
      display: flex; gap: 12px; align-items: flex-start; padding: 16px; border-radius: 16px;
      background: rgba(255, 255, 255, .12); border: 1px solid rgba(255, 255, 255, .22);
      backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
      animation: rise .6s .25s cubic-bezier(.2, .8, .2, 1) both;
    }
    .feature-icon {
      width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;
      background: rgba(255, 255, 255, .92); color: var(--blue); font-size: 1.15rem;
    }
    .feature:hover { transform: translateY(-2px); background: rgba(255, 255, 255, .18); }
    .feature-go { position: absolute; top: 12px; right: 12px; font-size: .8rem; opacity: .6; }
    .feature h3 { font-size: .95rem; font-weight: 700; margin: 0 0 3px; }
    .feature p { color: rgba(226, 232, 240, .88); font-size: .8rem; margin: 0; line-height: 1.45; }
    .footer { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding-bottom: 16px; color: rgba(203, 213, 225, .75); font-size: .78rem; }

    @keyframes drift { from { transform: translate(0, 0) scale(1); } to { transform: translate(40px, 30px) scale(1.1); } }
    @keyframes rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }

    @media (max-width: 1199.98px) {
      .features { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    /* Tablette et mobile : tout s'empile sur l'image */
    @media (max-width: 991.98px) {
      .hero { grid-template-columns: 1fr; gap: 28px; }
    }
    @media (max-width: 575.98px) {
      .features { grid-template-columns: 1fr; }
    }
    @media (prefers-reduced-motion: reduce) {
      .glow { animation: none; }
      .login-card, .feature { animation: none; }
    }
  `]
})
export class LoginComponent {
  readonly subjects = [
    { name: 'Comptabilité analytique', icon: 'bi-calculator', color: '#5567cc',
      text: 'Coûts complets et partiels, coût de revient, seuil de rentabilité et analyse des écarts, avec des cas pratiques corrigés ligne par ligne.' },
    { name: 'Droit', icon: 'bi-bank', color: '#a5b4fc',
      text: 'Droit des affaires et des sociétés : formes juridiques, contrats et obligations, illustrés par des cas concrets.' },
    { name: 'Réseaux', icon: 'bi-diagram-3', color: '#5eead4',
      text: 'Architecture des réseaux, protocoles TCP/IP, DNS, DHCP, adressage et sécurité, avec des travaux pratiques.' },
    { name: 'Programmation', icon: 'bi-code-slash', color: '#fdba74',
      text: 'Algorithmique et programmation orientée objet en Java, avec un environnement de développement intégré à la plateforme.' },
    { name: 'Mathématiques', icon: 'bi-plus-slash-minus', color: '#fda4af',
      text: 'Analyse, algèbre et mathématiques financières : dérivées, équations, suites et applications à la gestion.' }
  ];
  readonly features = [
    { icon: 'bi-book', title: 'Cours en ligne', text: 'Leçons, supports et exercices accessibles à tout moment.',
      details: 'Chaque cours regroupe des leçons, des supports à télécharger et des exercices pratiques (tableur, IDE Java, UML). Vous avancez à votre rythme et reprenez là où vous vous êtes arrêté.' },
    { icon: 'bi-clipboard-check', title: 'Examens et évaluations', text: 'QCM, cas pratiques et devoirs corrigés ligne par ligne.',
      details: 'Devoirs et examens en ligne, surveillés et chronométrés. Les QCM sont corrigés instantanément ; les cas pratiques sont comparés ligne par ligne à la correction du professeur, que vous répondiez en ligne ou en déposant votre copie (PDF ou photo).' },
    { icon: 'bi-bar-chart-line', title: 'Suivi des résultats', text: 'Notes, corrections détaillées et progression en temps réel.',
      details: 'Consultez vos notes, le détail de la correction de chaque copie et votre progression dans chaque cours. Les enseignants suivent les résultats de toute la classe et peuvent ajuster une note.' },
    { icon: 'bi-people', title: 'Interactivité', text: 'Classes virtuelles et échanges avec vos enseignants.',
      details: 'Participez aux classes virtuelles en visioconférence, retrouvez les enregistrements des séances et échangez avec vos enseignants.' }
  ];

  form: FormGroup;
  loading = false;
  error = '';
  showPassword = false;
  /** Déconnecté parce que le même compte s'est connecté ailleurs (une seule session par compte). */
  get sessionReplaced(): boolean { return this.route.snapshot.queryParamMap.get('reason') === 'session-replaced'; }
  readonly year = new Date().getFullYear();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private dialogs: DialogService
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }


  openForgot() {
    this.dialogs.open(ForgotPasswordDialogComponent, { title: 'Mot de passe oublié', icon: 'bi-key', size: 'sm' });
  }

  openSubject(subject: { name: string; icon: string; text: string }) {
    this.dialogs.alert({ title: subject.name, message: subject.text, icon: subject.icon, tone: 'primary', confirmText: 'Fermer' });
  }

  openFeature(feature: { title: string; icon: string; details: string }) {
    this.dialogs.alert({ title: feature.title, message: feature.details, icon: feature.icon, tone: 'primary', confirmText: 'Fermer' });
  }

  openAbout() {
    this.dialogs.alert({
      title: 'ITECOM',
      message: 'Plateforme d\'apprentissage en ligne : cours, cas pratiques, devoirs et examens corrigés automatiquement, suivi des résultats et classes virtuelles. Les comptes étudiants et enseignants sont créés par l\'administration de l\'établissement.',
      icon: 'bi-mortarboard', tone: 'primary', confirmText: 'Fermer'
    });
  }

  get online(): boolean { return navigator.onLine; }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.error = '';
    this.authService.login(this.form.value).subscribe({
      next: (resp) => {
        const returnUrl = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
        // Si la page demandée est refusée (rôle différent), on retombe sur le tableau de bord
        this.router.navigateByUrl(returnUrl).then(ok => { if (!ok) this.router.navigateByUrl('/dashboard'); });
      },
      error: (err) => {
        this.error = err.error?.message || 'Email ou mot de passe incorrect';
        this.loading = false;
      }
    });
  }
}
