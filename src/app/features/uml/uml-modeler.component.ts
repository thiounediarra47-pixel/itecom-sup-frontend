import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CourseService } from '../../core/services/course.service';
import { ProgressService } from '../../core/services/progress.service';
import { Lesson } from '../../core/models/course.model';
import { DialogService } from '../../core/services/dialog.service';

interface DiagramType {
  id: string;
  label: string;
  icon: string;
  syntax: string;
  description: string;
}

interface Template {
  label: string;
  code: string;
}

@Component({
  selector: 'app-uml-modeler',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="fade-in-up">

      <!-- Header -->
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 class="fw-bold mb-1"><i class="bi bi-rulers me-1"></i>Modélisation UML</h1>
          <p class="text-muted small">Créez tous vos diagrammes UML : classes, séquences, états, cas d'utilisation, activités, composants…</p>
        </div>
        <div class="d-flex gap-2 align-items-center flex-wrap">
          <select class="form-select form-select-sm" style="width:230px"
                  [(ngModel)]="selectedTemplate" (change)="applyTemplate(selectedTemplate)">
            <option value="">— Charger un modèle —</option>
            <option *ngFor="let t of currentTemplates" [value]="t.label">{{ t.label }}</option>
          </select>
          <button class="btn btn-outline-secondary btn-sm" (click)="clearConfirm()">
            <i class="bi bi-trash me-1"></i>Effacer
          </button>
          <button class="btn btn-outline-primary btn-sm" (click)="exportSVG()">
            <i class="bi bi-filetype-svg me-1"></i>SVG
          </button>
          <button class="btn btn-outline-success btn-sm" (click)="exportPNG()">
            <i class="bi bi-image me-1"></i>PNG
          </button>
          <button class="btn btn-outline-secondary btn-sm" (click)="exportCode()">
            <i class="bi bi-cloud-arrow-up me-1"></i>Exporter
          </button>
          <button class="btn btn-outline-secondary btn-sm" (click)="importCode()">
            <i class="bi bi-cloud-arrow-down me-1"></i>Importer
          </button>
        </div>
      </div>

      <div class="d-flex gap-3">

        <!-- Exercise panel -->
        <div *ngIf="exercise" class="exercise-panel">
          <div class="card border-0 shadow-sm h-100" style="border-radius:12px">
            <div class="card-body d-flex flex-column">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <span class="badge bg-primary"><i class="bi bi-diagram-3 me-1"></i>Exercice UML</span>
                <span *ngIf="exercise.completed" class="badge bg-success">
                  <i class="bi bi-check-circle me-1"></i>Terminé
                </span>
              </div>
              <h5 class="fw-bold">{{ exercise.title }}</h5>
              <div class="text-muted small mb-3" style="white-space:pre-wrap">{{ exercise.description }}</div>
              <div class="mt-auto d-flex flex-column gap-2">
                <button *ngIf="!exercise.completed" class="btn btn-success btn-sm"
                        (click)="markComplete()" [disabled]="markingComplete">
                  <span *ngIf="markingComplete" class="spinner-border spinner-border-sm me-2"></span>
                  <i *ngIf="!markingComplete" class="bi bi-check-circle me-1"></i>Marquer comme terminé
                </button>
                <a [routerLink]="['/courses', exercise.courseId, 'learn']" class="btn btn-outline-secondary btn-sm">
                  <i class="bi bi-arrow-left me-1"></i>Retour au cours
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Main workspace -->
        <div class="flex-grow-1" style="min-width:0">

          <!-- Diagram type tabs -->
          <div class="d-flex gap-1 flex-wrap mb-2">
            <button *ngFor="let dt of diagramTypes"
                    class="btn btn-sm"
                    [class.btn-primary]="activeDiagramType === dt.id"
                    [class.btn-outline-secondary]="activeDiagramType !== dt.id"
                    (click)="selectDiagramType(dt.id)"
                    [title]="dt.description">
              <i class="bi me-1" [ngClass]="dt.icon"></i>{{ dt.label }}
            </button>
          </div>

          <!-- Split: editor | preview -->
          <div class="uml-workspace">

            <!-- Editor -->
            <div class="editor-panel">
              <div class="d-flex justify-content-between align-items-center mb-1 px-1">
                <span class="small text-muted fw-semibold">
                  <i class="bi bi-pencil-square me-1"></i>Éditeur
                  <span class="badge bg-light text-secondary ms-2" style="font-size:.6rem">{{ activeSyntaxLabel }}</span>
                </span>
                <button class="btn btn-sm btn-outline-primary" style="font-size:.75rem;padding:2px 8px" (click)="renderDiagram()">
                  <i class="bi bi-play-fill me-1"></i>Rafraîchir
                </button>
              </div>
              <textarea
                class="code-editor"
                [(ngModel)]="code"
                (input)="onCodeChange()"
                spellcheck="false"
                placeholder="Entrez votre code UML ici…"
                #editorArea></textarea>
            </div>

            <!-- Preview -->
            <div class="preview-panel">
              <div class="d-flex justify-content-between align-items-center mb-1 px-1">
                <span class="small text-muted fw-semibold"><i class="bi bi-eye me-1"></i>Aperçu</span>
                <div class="d-flex gap-1 align-items-center">
                  <select class="form-select form-select-sm" style="width:110px;font-size:.7rem" [(ngModel)]="theme" (change)="renderDiagram()">
                    <option value="default">Défaut</option>
                    <option value="forest">Forest</option>
                    <option value="dark">Sombre</option>
                    <option value="neutral">Neutre</option>
                    <option value="base">Base</option>
                  </select>
                  <button class="btn btn-sm btn-outline-secondary" style="font-size:.7rem;padding:2px 8px"
                          (click)="zoomIn()" title="Zoom +">+</button>
                  <span class="small text-muted" style="min-width:35px;text-align:center">{{ (zoom * 100).toFixed(0) }}%</span>
                  <button class="btn btn-sm btn-outline-secondary" style="font-size:.7rem;padding:2px 8px"
                          (click)="zoomOut()" title="Zoom -">−</button>
                  <button class="btn btn-sm btn-outline-secondary" style="font-size:.7rem;padding:2px 8px"
                          (click)="zoom = 1" title="Réinitialiser zoom">⟳</button>
                </div>
              </div>
              <div class="preview-container" [class.dark-bg]="theme === 'dark'">
                <div *ngIf="loading" class="d-flex justify-content-center align-items-center h-100">
                  <div class="spinner-border text-primary" role="status"></div>
                </div>
                <div *ngIf="error && !loading" class="error-box">
                  <i class="bi bi-exclamation-triangle-fill text-danger me-2"></i>
                  <span class="small text-danger">{{ error }}</span>
                </div>
                <div *ngIf="!loading && !error" #previewEl
                     class="preview-svg-wrapper"
                     [style.transform]="'scale(' + zoom + ')'"
                     [style.transformOrigin]="'top left'"
                     [innerHTML]="svgContent"></div>
              </div>
            </div>

          </div>

          <!-- Cheat sheet -->
          <div class="card border-0 bg-light mt-3" style="border-radius:12px">
            <div class="card-body p-3">
              <h6 class="fw-bold mb-2">
                <i class="bi bi-info-circle text-primary me-2"></i>Syntaxe — {{ currentDiagramType.label }}
              </h6>
              <div class="small text-muted" [innerHTML]="currentDiagramType.syntax"></div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`
    .exercise-panel { width: 300px; flex-shrink: 0; }
    .uml-workspace { display: flex; gap: 12px; height: calc(100vh - 340px); min-height: 420px; }
    .editor-panel { display: flex; flex-direction: column; width: 45%; flex-shrink: 0; }
    .preview-panel { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .code-editor {
      flex: 1;
      width: 100%;
      resize: none;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 10px 12px;
      font-family: 'Fira Mono', 'Consolas', monospace;
      font-size: 0.82rem;
      line-height: 1.55;
      background: #1e1e2e;
      color: #cdd6f4;
      outline: none;
      tab-size: 2;
    }
    .code-editor:focus { border-color: #2b3ea8; box-shadow: 0 0 0 2px rgba(43, 62, 168,.15); }
    .preview-container {
      flex: 1;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      background: var(--surface);
      overflow: auto;
      padding: 16px;
      position: relative;
    }
    .preview-container.dark-bg { background: #1e1e2e; }
    .preview-svg-wrapper { display: inline-block; }
    .preview-svg-wrapper :host ::ng-deep svg { max-width: 100%; height: auto; }
    .error-box { padding: 12px; background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca; }
    @media(max-width: 992px) {
      .uml-workspace { flex-direction: column; height: auto; }
      .editor-panel { width: 100%; height: 280px; }
      .preview-panel { height: 320px; }
      .d-flex.gap-3 { flex-direction: column; }
      .exercise-panel { width: 100%; }
    }
  `]
})
export class UmlModelerComponent implements OnInit, OnDestroy {
  @ViewChild('previewEl') previewEl!: ElementRef;

  code = '';
  svgContent = '';
  error = '';
  loading = false;
  theme = 'default';
  zoom = 1;
  selectedTemplate = '';
  activeDiagramType = 'class';
  markingComplete = false;
  exercise: Lesson | null = null;

  private renderTimer: any;
  private mermaidLoaded = false;
  private renderCounter = 0;

  diagramTypes: DiagramType[] = [
    {
      id: 'class',
      label: 'Classes',
      icon: 'bi-bank2',
      description: 'Diagramme de classes UML',
      syntax: `<code>classDiagram</code> — classes, attributs, méthodes, relations<br>
        <code>class NomClasse { +attribut: Type; +methode(): retour }</code><br>
        Relations : <code>A --|> B</code> (héritage) &nbsp; <code>A --o B</code> (agrégation) &nbsp; <code>A --* B</code> (composition) &nbsp; <code>A --> B</code> (association) &nbsp; <code>A ..> B</code> (dépendance)<br>
        Visibilité : <code>+</code> public &nbsp; <code>-</code> privé &nbsp; <code>#</code> protégé &nbsp; <code>~</code> package<br>
        <code><<interface>></code> &nbsp; <code><<abstract>></code> &nbsp; <code><<enum>></code>`
    },
    {
      id: 'sequence',
      label: 'Séquence',
      icon: 'bi-arrow-repeat',
      description: 'Diagramme de séquence UML',
      syntax: `<code>sequenceDiagram</code> — interactions chronologiques entre acteurs<br>
        <code>participant A</code> &nbsp; <code>actor Utilisateur</code><br>
        Messages : <code>A->>B: message</code> (asynchrone) &nbsp; <code>A->B: message</code> (synchrone) &nbsp; <code>A-->>B: réponse</code> (réponse)<br>
        <code>activate A</code> / <code>deactivate A</code> &nbsp; <code>Note over A,B: texte</code><br>
        <code>loop Condition</code> … <code>end</code> &nbsp; <code>alt Cas</code> … <code>else</code> … <code>end</code> &nbsp; <code>opt</code> … <code>end</code>`
    },
    {
      id: 'usecase',
      label: "Cas d'utilisation",
      icon: 'bi-person',
      description: "Diagramme de cas d'utilisation UML",
      syntax: `Simulé avec <code>flowchart LR</code> — acteurs et cas d'utilisation<br>
        Acteurs : <code>A([Acteur])</code> &nbsp; Cas d'utilisation : <code>CU1(Nom du cas)</code><br>
        Associations : <code>A --> CU1</code> &nbsp; Include : <code>CU1 -.->|include| CU2</code> &nbsp; Extend : <code>CU1 -.->|extend| CU3</code><br>
        Sous-système : <code>subgraph Système</code> … <code>end</code>`
    },
    {
      id: 'activity',
      label: 'Activité',
      icon: 'bi-arrow-repeat',
      description: "Diagramme d'activité UML",
      syntax: `<code>flowchart TD</code> (top-down) ou <code>LR</code> (left-right)<br>
        Début/fin : <code>S([●Début])</code> &nbsp; <code>E([◎Fin])</code><br>
        Action : <code>A[Action]</code> &nbsp; Décision : <code>D{Condition ?}</code><br>
        Couloirs (swimlanes) : <code>subgraph Acteur</code> … <code>end</code><br>
        Transitions : <code>A --> B</code> &nbsp; avec label : <code>A -->|oui| B</code>`
    },
    {
      id: 'state',
      label: 'États',
      icon: 'bi-shuffle',
      description: "Diagramme d'états UML",
      syntax: `<code>stateDiagram-v2</code> — états et transitions<br>
        <code>[*] --> NomEtat</code> (état initial) &nbsp; <code>NomEtat --> [*]</code> (état final)<br>
        <code>EtatA --> EtatB : evenement</code><br>
        États composites : <code>state NomComposite { ... }</code><br>
        Concurrence : <code>state NomParallele { A \n -- \n B }</code><br>
        <code>note right of EtatA : texte</code>`
    },
    {
      id: 'component',
      label: 'Composants',
      icon: 'bi-puzzle',
      description: 'Diagramme de composants UML',
      syntax: `Simulé avec <code>graph TD</code> ou <code>LR</code><br>
        Composant : <code>A[/Composant/]</code> &nbsp; Interface : <code>I((Interface))</code> &nbsp; Base de données : <code>DB[(Base de données)]</code><br>
        Paquetage : <code>subgraph Paquetage</code> … <code>end</code><br>
        Dépendance : <code>A -.-> B</code> &nbsp; Liaison : <code>A --> B</code>`
    },
    {
      id: 'deployment',
      label: 'Déploiement',
      icon: 'bi-pc-display',
      description: 'Diagramme de déploiement UML',
      syntax: `Simulé avec <code>graph TD</code><br>
        Nœud : <code>N[Nœud Physique]</code> &nbsp; Artefact : <code>A(Artefact)</code> &nbsp; Serveur : <code>S[/Serveur/]</code><br>
        Sous-nœud : <code>subgraph Serveur d'application</code> … <code>end</code><br>
        Communication : <code>A -- HTTP --> B</code> &nbsp; <code>A -- TCP/IP --> B</code>`
    },
    {
      id: 'er',
      label: 'ER / MCD',
      icon: 'bi-archive',
      description: 'Diagramme Entité-Relation (MCD/MLD)',
      syntax: `<code>erDiagram</code> — entités et associations<br>
        <code>ENTITE { type attribut "description" }</code><br>
        Cardinalités : <code>||--||</code> (1-1) &nbsp; <code>||--o{</code> (1-N) &nbsp; <code>}o--o{</code> (N-N)<br>
        Relation : <code>CLIENT ||--o{ COMMANDE : "passe"</code><br>
        Types : <code>int</code> <code>string</code> <code>boolean</code> <code>date</code> <code>float</code>`
    },
    {
      id: 'mindmap',
      label: 'Mind Map',
      icon: 'bi-cpu',
      description: 'Carte mentale / Mind Map',
      syntax: `<code>mindmap</code> — arbre de concepts<br>
        Racine : <code>root((Concept central))</code><br>
        Niveaux : indentation avec 2 espaces<br>
        Formes : <code>((cercle))</code> &nbsp; <code>[carré]</code> &nbsp; <code>(arrondi)</code> &nbsp; <code>>asymétrique]</code><br>
        Icônes : <code>::icon(bi bi-star)</code>`
    }
  ];

  private templates: Record<string, Template[]> = {
    class: [
      {
        label: 'Système universitaire',
        code: `classDiagram
  class Personne {
    +String nom
    +String prenom
    +Date dateNaissance
    +getAge() int
  }

  class Etudiant {
    +String matricule
    +int niveau
    +s_inscrire(cours: Cours) void
    +consulterNotes() List~Note~
  }

  class Enseignant {
    +String grade
    +String specialite
    +creerCours(titre: String) Cours
    +noterEtudiant(e: Etudiant, note: float) void
  }

  class Cours {
    +int id
    +String titre
    +int credits
    +String description
  }

  class Note {
    +float valeur
    +String mention
  }

  Personne <|-- Etudiant : héritage
  Personne <|-- Enseignant : héritage
  Etudiant "N" --> "N" Cours : suit
  Enseignant "1" --> "N" Cours : enseigne
  Etudiant "1" --* "N" Note : possède
  Cours "1" --o "N" Note : concerne`
      },
      {
        label: 'Système bancaire',
        code: `classDiagram
  class Client {
    +int id
    +String nom
    +String email
    +String telephone
    +ouvrir_compte() Compte
  }

  class Compte {
    +String numero
    +float solde
    +Date dateCreation
    +deposer(montant: float) void
    +retirer(montant: float) boolean
    +getHistorique() List~Transaction~
  }

  class CompteCourant {
    +float decouvertAutorise
    +float fraisGestion
  }

  class CompteEpargne {
    +float tauxInteret
    +calculerInterets() float
  }

  class Transaction {
    +int id
    +float montant
    +Date date
    +String type
    +String description
  }

  class CarteBancaire {
    +String numero
    +Date dateExpiration
    +String cvv
    +bloquer() void
  }

  Client "1" --* "N" Compte : possède
  Compte <|-- CompteCourant
  Compte <|-- CompteEpargne
  Compte "1" --* "N" Transaction : enregistre
  Client "1" --o "N" CarteBancaire : détient`
      },
      {
        label: 'E-commerce',
        code: `classDiagram
  class Utilisateur {
    +int id
    +String email
    +String motDePasse
    +s_authentifier() boolean
  }

  class Client {
    +String adresseLivraison
    +String adresseFacturation
    +passerCommande() Commande
  }

  class Administrateur {
    +gererProduits() void
    +genererRapport() Rapport
  }

  class Produit {
    +int id
    +String nom
    +float prix
    +int stock
    +String description
    +String categorie
  }

  class Commande {
    +int numero
    +Date date
    +String statut
    +float total
    +calculerTotal() float
  }

  class LigneCommande {
    +int quantite
    +float prixUnitaire
  }

  class Paiement {
    +String methode
    +float montant
    +boolean statut
    +traiter() boolean
  }

  Utilisateur <|-- Client
  Utilisateur <|-- Administrateur
  Client "1" --* "N" Commande : passe
  Commande "1" --* "N" LigneCommande : contient
  LigneCommande "N" --> "1" Produit : référence
  Commande "1" --> "1" Paiement : génère`
      },
      {
        label: 'Vide (démarrer)',
        code: `classDiagram
  class MaClasse {
    +String attributPublic
    -int attributPrive
    #boolean attributProtege
    +methodePublique() void
    -methodePrivee(param: String) int
  }

  class AutreClasse {
    +String nom
  }

  MaClasse --> AutreClasse : association`
      }
    ],
    sequence: [
      {
        label: 'Authentification',
        code: `sequenceDiagram
  actor U as Utilisateur
  participant B as Navigateur
  participant S as Serveur API
  participant DB as Base de données

  U->>B: Saisit email + mot de passe
  B->>S: POST /auth/login {email, password}
  activate S

  S->>DB: SELECT * FROM users WHERE email = ?
  activate DB
  DB-->>S: Données utilisateur (hash)
  deactivate DB

  alt Mot de passe valide
    S->>S: Génère JWT token (exp: 24h)
    S-->>B: 200 OK {token, user}
    deactivate S
    B->>B: Stocke token dans localStorage
    B-->>U: Redirige vers tableau de bord
  else Mot de passe invalide
    S-->>B: 401 Unauthorized
    deactivate S
    B-->>U: Affiche message d'erreur
  end`
      },
      {
        label: 'Processus de commande',
        code: `sequenceDiagram
  actor C as Client
  participant Site as Site Web
  participant Panier as Service Panier
  participant Paiement as Service Paiement
  participant Stock as Service Stock
  participant Livraison as Service Livraison

  C->>Site: Sélectionne des articles
  Site->>Panier: addToCart(produitId, quantite)
  Panier-->>Site: Panier mis à jour

  C->>Site: Valide la commande
  Site->>Stock: verifierStock(articles)
  activate Stock
  Stock-->>Site: Stock disponible
  deactivate Stock

  Site->>Paiement: initierPaiement(montant, carte)
  activate Paiement
  Paiement->>Paiement: Traitement bancaire
  alt Paiement accepté
    Paiement-->>Site: Paiement confirmé
    deactivate Paiement
    Site->>Stock: diminuerStock(articles)
    Site->>Livraison: creerColis(commande)
    Livraison-->>Site: Numéro de suivi
    Site-->>C: Confirmation + N° de suivi
  else Paiement refusé
    Paiement-->>Site: Erreur paiement
    Site-->>C: Paiement refusé, réessayer
  end`
      },
      {
        label: 'Application mobile API',
        code: `sequenceDiagram
  actor U as Utilisateur
  participant App as App Mobile
  participant API as API REST
  participant Cache as Cache Redis
  participant DB as PostgreSQL

  U->>App: Ouvre la liste des produits
  App->>Cache: GET products:list
  activate Cache
  alt Cache HIT
    Cache-->>App: Données en cache
    deactivate Cache
    App-->>U: Affiche produits (rapide)
  else Cache MISS
    Cache-->>App: null
    deactivate Cache
    App->>API: GET /api/products
    activate API
    API->>DB: SELECT * FROM products LIMIT 20
    activate DB
    DB-->>API: Résultats
    deactivate DB
    API->>Cache: SET products:list (TTL: 5min)
    API-->>App: 200 OK [produits]
    deactivate API
    App-->>U: Affiche produits
  end`
      },
      {
        label: 'Vide (démarrer)',
        code: `sequenceDiagram
  actor A as Acteur A
  participant B as Composant B
  participant C as Composant C

  A->>B: message()
  activate B
  B->>C: appel()
  activate C
  C-->>B: réponse
  deactivate C
  B-->>A: résultat
  deactivate B`
      }
    ],
    usecase: [
      {
        label: 'Gestion scolaire',
        code: `flowchart LR
  subgraph Acteurs
    E([Étudiant])
    P([Professeur])
    A([Administrateur])
  end

  subgraph Système de Gestion Scolaire
    CU1(S'inscrire à un cours)
    CU2(Consulter les notes)
    CU3(Télécharger les ressources)
    CU4(Soumettre un devoir)
    CU5(Corriger les devoirs)
    CU6(Saisir les notes)
    CU7(Créer un cours)
    CU8(Gérer les utilisateurs)
    CU9(Générer des rapports)
    CU10(S'authentifier)
  end

  E --> CU1
  E --> CU2
  E --> CU3
  E --> CU4
  P --> CU5
  P --> CU6
  P --> CU7
  A --> CU8
  A --> CU9

  CU1 -.->|include| CU10
  CU2 -.->|include| CU10
  CU5 -.->|include| CU10
  CU4 -.->|extend| CU3`
      },
      {
        label: 'Application bancaire',
        code: `flowchart LR
  subgraph Acteurs
    C([Client])
    G([Gestionnaire])
    SYS([Système externe])
  end

  subgraph Application Bancaire
    CU1(Consulter solde)
    CU2(Effectuer virement)
    CU3(Payer une facture)
    CU4(Gérer carte bancaire)
    CU5(Ouvrir un compte)
    CU6(Générer relevé)
    CU7(Valider transaction)
    CU8(S'authentifier)
    CU9(Récupérer mot de passe)
  end

  C --> CU1
  C --> CU2
  C --> CU3
  C --> CU4
  G --> CU5
  G --> CU6
  G --> CU7
  SYS --> CU7

  CU1 -.->|include| CU8
  CU2 -.->|include| CU8
  CU2 -.->|include| CU7
  CU8 -.->|extend| CU9`
      },
      {
        label: 'Vide (démarrer)',
        code: `flowchart LR
  subgraph Acteurs
    A([Acteur Principal])
    B([Acteur Secondaire])
  end

  subgraph Système
    CU1(Cas d'utilisation 1)
    CU2(Cas d'utilisation 2)
    CU3(Cas d'utilisation 3)
  end

  A --> CU1
  A --> CU2
  B --> CU3
  CU1 -.->|include| CU3`
      }
    ],
    activity: [
      {
        label: 'Processus de connexion',
        code: `flowchart TD
  S([Début]) --> F1[Afficher formulaire de connexion]
  F1 --> F2[Saisir email et mot de passe]
  F2 --> D1{Champs remplis ?}
  D1 -->|Non| F1
  D1 -->|Oui| A1[Envoyer requête au serveur]

  subgraph Serveur
    A1 --> D2{Utilisateur existant ?}
    D2 -->|Non| ERR1[Retourner erreur 404]
    D2 -->|Oui| D3{Mot de passe correct ?}
    D3 -->|Non| ERR2[Retourner erreur 401]
    D3 -->|Oui| A2[Générer JWT Token]
  end

  A2 --> A3[Stocker token]
  ERR1 --> MSG1[Afficher erreur utilisateur]
  ERR2 --> MSG2[Afficher erreur mot de passe]
  MSG1 --> F2
  MSG2 --> F2
  A3 --> E([Fin])`
      },
      {
        label: 'Traitement commande',
        code: `flowchart TD
  S([Début]) --> A1[Client ajoute au panier]
  A1 --> A2[Client valide la commande]
  A2 --> D1{Client authentifié ?}
  D1 -->|Non| A3[Connexion / Inscription]
  A3 --> A2
  D1 -->|Oui| D2{Stock disponible ?}

  subgraph Vérification Stock
    D2 -->|Non| B1[Notifier rupture de stock]
    B1 --> B2[Proposer délai ou alternative]
    D2 -->|Oui| C1[Réserver le stock]
  end

  C1 --> D3{Mode de paiement}
  D3 -->|Carte bancaire| P1[Traitement CB]
  D3 -->|Virement| P2[Traitement virement]
  D3 -->|PayPal| P3[Redirection PayPal]

  P1 --> D4{Paiement accepté ?}
  P2 --> D4
  P3 --> D4

  D4 -->|Non| ERR[Afficher erreur paiement]
  ERR --> D3
  D4 -->|Oui| CONF[Envoyer confirmation email]
  CONF --> LIV[Préparer livraison]
  LIV --> E([Fin])`
      },
      {
        label: 'Vide (démarrer)',
        code: `flowchart TD
  S([Début]) --> A1[Première action]
  A1 --> D1{Condition ?}
  D1 -->|Oui| A2[Action si vrai]
  D1 -->|Non| A3[Action si faux]
  A2 --> E([Fin])
  A3 --> E`
      }
    ],
    state: [
      {
        label: 'Cycle de vie commande',
        code: `stateDiagram-v2
  [*] --> EnAttente : Commande créée

  EnAttente --> Confirmée : Paiement reçu
  EnAttente --> Annulée : Timeout / Annulation client

  Confirmée --> EnPréparation : Traitement démarré
  Confirmée --> Annulée : Annulation avant expédition

  EnPréparation --> Expédiée : Colis remis au transporteur
  EnPréparation --> Annulée : Rupture de stock

  Expédiée --> EnTransit : Prise en charge transporteur
  EnTransit --> Livrée : Remise au destinataire
  EnTransit --> EnEchec : Adresse incorrecte / Absent

  EnEchec --> EnTransit : Nouvelle tentative
  EnEchec --> Retournée : Impossible à livrer

  Livrée --> [*]
  Annulée --> [*]
  Retournée --> [*]

  note right of EnPréparation : Génération bon de livraison
  note right of Expédiée : Email + numéro de suivi envoyé`
      },
      {
        label: 'Feu de circulation',
        code: `stateDiagram-v2
  [*] --> Rouge

  Rouge --> Vert : Temporisation (30s)
  Vert --> OrangeVert : Temporisation (25s)
  OrangeVert --> Rouge : Temporisation (5s)

  state Rouge {
    [*] --> AttentePiétons
    AttentePiétons --> PiétonsPassent : Signal piéton
    PiétonsPassent --> [*] : Fin traversée
  }

  note right of Vert : Véhicules passent
  note right of Rouge : Piétons traversent`
      },
      {
        label: 'Session utilisateur',
        code: `stateDiagram-v2
  [*] --> NonConnecté

  NonConnecté --> Connexion : Ouvre l'application
  Connexion --> Authentifié : Identifiants corrects
  Connexion --> NonConnecté : Identifiants incorrects

  Authentifié --> Actif : Interaction utilisateur
  Authentifié --> EnVeille : Inactivité (5 min)

  Actif --> EnVeille : Inactivité (5 min)
  EnVeille --> Actif : Reprise d'activité
  EnVeille --> Déconnecté : Timeout (30 min)

  Actif --> Déconnecté : Déconnexion manuelle
  Authentifié --> Déconnecté : Déconnexion manuelle

  Déconnecté --> [*]`
      },
      {
        label: 'Vide (démarrer)',
        code: `stateDiagram-v2
  [*] --> EtatInitial

  EtatInitial --> EtatA : evenement1
  EtatA --> EtatB : evenement2
  EtatB --> EtatInitial : evenement3
  EtatB --> [*] : terminé`
      }
    ],
    component: [
      {
        label: 'Architecture Web 3-tiers',
        code: `graph TD
  subgraph Client[Tier Présentation]
    Browser[/Navigateur Web/]
    Mobile[/Application Mobile/]
  end

  subgraph Application[Tier Application]
    LB[Load Balancer]
    API1[API Server 1]
    API2[API Server 2]
    Auth[Service Auth]
    Email[Service Email]
  end

  subgraph Data[Tier Données]
    DB[(PostgreSQL)]
    Cache[(Redis Cache)]
    Files[(Stockage Fichiers)]
    Queue[(Message Queue)]
  end

  Browser --> LB
  Mobile --> LB
  LB --> API1
  LB --> API2
  API1 --> Auth
  API2 --> Auth
  API1 --> DB
  API2 --> DB
  API1 --> Cache
  API2 --> Cache
  API1 --> Queue
  Queue --> Email
  API1 --> Files`
      },
      {
        label: 'Microservices',
        code: `graph LR
  subgraph Frontend
    WEB[/Application Web/]
    MOB[/Application Mobile/]
  end

  subgraph API_Gateway[API Gateway]
    GW[Gateway / Routeur]
    AUTH[Auth Middleware]
  end

  subgraph Services[Microservices]
    US[User Service]
    PS[Product Service]
    OS[Order Service]
    PAY[Payment Service]
    NOTIF[Notification Service]
  end

  subgraph Databases[Bases de données]
    UDB[(Users DB)]
    PDB[(Products DB)]
    ODB[(Orders DB)]
  end

  subgraph Broker[Message Broker]
    MQ[(Kafka / RabbitMQ)]
  end

  WEB --> GW
  MOB --> GW
  GW --> AUTH
  AUTH --> US
  AUTH --> PS
  AUTH --> OS
  OS --> PAY
  OS --> MQ
  MQ --> NOTIF
  US --> UDB
  PS --> PDB
  OS --> ODB`
      },
      {
        label: 'Vide (démarrer)',
        code: `graph TD
  subgraph Couche1[Première couche]
    C1[/Composant 1/]
    C2[/Composant 2/]
  end

  subgraph Couche2[Deuxième couche]
    C3[/Composant 3/]
    DB[(Base de données)]
  end

  C1 --> C3
  C2 --> C3
  C3 --> DB`
      }
    ],
    deployment: [
      {
        label: 'Infrastructure Cloud',
        code: `graph TD
  subgraph Internet[Internet]
    USER[Utilisateurs]
    CDN[CDN CloudFront]
  end

  subgraph AWS[AWS Cloud]
    subgraph DMZ[Zone DMZ]
      WAF[WAF - Pare-feu]
      LB[Load Balancer]
    end

    subgraph AppTier[Zone Application]
      subgraph AZ1[Zone de disponibilité 1]
        APP1[App Server 1\nec2.t3.large]
      end
      subgraph AZ2[Zone de disponibilité 2]
        APP2[App Server 2\nec2.t3.large]
      end
    end

    subgraph DataTier[Zone Données]
      RDS[(RDS PostgreSQL\nMulti-AZ)]
      REDIS[(ElastiCache Redis)]
      S3[(S3 Bucket)]
    end
  end

  USER -- HTTPS --> CDN
  CDN -- HTTPS --> WAF
  WAF --> LB
  LB --> APP1
  LB --> APP2
  APP1 -- TCP 5432 --> RDS
  APP2 -- TCP 5432 --> RDS
  APP1 -- TCP 6379 --> REDIS
  APP2 --> S3`
      },
      {
        label: 'Infrastructure On-Premise',
        code: `graph TD
  subgraph Internet[Internet]
    EXT[Utilisateurs externes]
  end

  subgraph DMZ[Zone DMZ]
    FW[Firewall]
    PROXY[Reverse Proxy\nNginx]
  end

  subgraph LAN[Réseau Local]
    subgraph PROD[Serveurs Production]
      WEB1[Serveur Web 1\nUbuntu 22.04]
      WEB2[Serveur Web 2\nUbuntu 22.04]
      JAVA[Serveur Java\nSpring Boot :8080]
    end

    subgraph DATA[Serveurs de données]
      DB_PRIMARY[(PostgreSQL\nPrimaire)]
      DB_REPLICA[(PostgreSQL\nReplica)]
      BACKUP[Serveur de sauvegarde]
    end

    subgraph INFRA[Infrastructure]
      LDAP[LDAP / AD]
      MAIL[Serveur Mail]
      MONITOR[Monitoring\nGrafana]
    end
  end

  EXT -- HTTPS 443 --> FW
  FW --> PROXY
  PROXY --> WEB1
  PROXY --> WEB2
  WEB1 --> JAVA
  WEB2 --> JAVA
  JAVA -- 5432 --> DB_PRIMARY
  DB_PRIMARY -- Replication --> DB_REPLICA
  DB_PRIMARY --> BACKUP`
      },
      {
        label: 'Vide (démarrer)',
        code: `graph TD
  subgraph Reseau1[Réseau 1]
    N1[Nœud 1]
    N2[Nœud 2]
  end

  subgraph Reseau2[Réseau 2]
    DB[(Base de données)]
  end

  N1 -- HTTP --> N2
  N2 -- TCP --> DB`
      }
    ],
    er: [
      {
        label: 'Base de données universitaire',
        code: `erDiagram
  ETUDIANT {
    int id PK "Identifiant unique"
    string matricule UK "Numéro étudiant"
    string nom "Nom de famille"
    string prenom "Prénom"
    date date_naissance "Date de naissance"
    string email UK "Email institutionnel"
    int niveau "Niveau d'études (1-5)"
  }

  COURS {
    int id PK "Identifiant"
    string code UK "Code du cours"
    string titre "Intitulé du cours"
    int credits "Nombre de crédits"
    string description "Description"
  }

  ENSEIGNANT {
    int id PK "Identifiant"
    string nom "Nom"
    string prenom "Prénom"
    string email UK "Email"
    string grade "Grade académique"
    string specialite "Domaine de spécialité"
  }

  INSCRIPTION {
    int id PK "Identifiant"
    int etudiant_id FK "Référence étudiant"
    int cours_id FK "Référence cours"
    date date_inscription "Date d'inscription"
    float note "Note obtenue (0-20)"
    string statut "admis / ajourné / absent"
  }

  DEPARTEMENT {
    int id PK "Identifiant"
    string nom "Nom du département"
    string code UK "Code département"
  }

  ETUDIANT ||--o{ INSCRIPTION : "s'inscrit à"
  COURS ||--o{ INSCRIPTION : "accueille"
  ENSEIGNANT ||--o{ COURS : "enseigne"
  DEPARTEMENT ||--o{ COURS : "propose"
  DEPARTEMENT ||--o{ ENSEIGNANT : "emploie"`
      },
      {
        label: 'E-commerce',
        code: `erDiagram
  CLIENT {
    int id PK
    string nom
    string email UK
    string telephone
    string adresse
  }

  COMMANDE {
    int id PK
    int client_id FK
    date date_commande
    string statut
    float total
    string adresse_livraison
  }

  PRODUIT {
    int id PK
    string nom
    float prix
    int stock
    string categorie
    int fournisseur_id FK
  }

  LIGNE_COMMANDE {
    int id PK
    int commande_id FK
    int produit_id FK
    int quantite
    float prix_unitaire
  }

  PAIEMENT {
    int id PK
    int commande_id FK
    string methode
    float montant
    date date_paiement
    boolean valide
  }

  FOURNISSEUR {
    int id PK
    string nom
    string contact
    string pays
  }

  CLIENT ||--o{ COMMANDE : "passe"
  COMMANDE ||--o{ LIGNE_COMMANDE : "contient"
  PRODUIT ||--o{ LIGNE_COMMANDE : "figure dans"
  COMMANDE ||--|| PAIEMENT : "réglée par"
  FOURNISSEUR ||--o{ PRODUIT : "fournit"`
      },
      {
        label: 'Vide (démarrer)',
        code: `erDiagram
  ENTITE_A {
    int id PK "Clé primaire"
    string nom "Nom"
    int entite_b_id FK "Clé étrangère"
  }

  ENTITE_B {
    int id PK "Clé primaire"
    string description "Description"
  }

  ENTITE_A }o--|| ENTITE_B : "appartient à"`
      }
    ],
    mindmap: [
      {
        label: 'Génie logiciel',
        code: `mindmap
  root((Génie Logiciel))
    Conception
      UML
        Diagramme de classes
        Diagramme de séquence
        Cas d'utilisation
        Diagramme d'états
      Patterns de conception
        Créationnels
          Singleton
          Factory
        Structurels
          Adapter
          Façade
        Comportementaux
          Observer
          Strategy
    Développement
      Langages
        Java / Kotlin
        Python
        JavaScript
        C++ / C
      Frameworks
        Spring Boot
        Angular / React
        Django
    Tests
      Tests unitaires
        JUnit
        pytest
      Tests d'intégration
      Tests de charge
    Méthodologies
      Agile
        Scrum
        Kanban
      Cycle en V
      DevOps
        CI / CD
        Docker
        Kubernetes`
      },
      {
        label: 'Vide (démarrer)',
        code: `mindmap
  root((Concept Central))
    Branche A
      Sous-branche A1
      Sous-branche A2
    Branche B
      Sous-branche B1
    Branche C`
      }
    ]
  };

  get currentTemplates(): Template[] {
    return this.templates[this.activeDiagramType] ?? [];
  }

  get currentDiagramType(): DiagramType {
    return this.diagramTypes.find(d => d.id === this.activeDiagramType) ?? this.diagramTypes[0];
  }

  get activeSyntaxLabel(): string {
    const labels: Record<string, string> = {
      class: 'classDiagram',
      sequence: 'sequenceDiagram',
      usecase: 'flowchart LR',
      activity: 'flowchart TD',
      state: 'stateDiagram-v2',
      component: 'graph',
      deployment: 'graph TD',
      er: 'erDiagram',
      mindmap: 'mindmap'
    };
    return labels[this.activeDiagramType] ?? 'mermaid';
  }

  constructor(private dialogs: DialogService, 
    private cdr: ChangeDetectorRef,
    private courseService: CourseService,
    private progressService: ProgressService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.loadMermaid().then(() => {
      this.applyTemplate(this.templates['class'][0].label);
    });

    const lessonId = this.route.snapshot.queryParamMap.get('lessonId');
    if (lessonId) {
      this.courseService.getLessonById(+lessonId).subscribe(lesson => {
        this.exercise = lesson;
        if (lesson.starterCode?.trim()) {
          this.code = lesson.starterCode;
          this.renderDiagram();
        }
      });
    }
  }

  ngOnDestroy() {
    if (this.renderTimer) clearTimeout(this.renderTimer);
  }

  selectDiagramType(id: string) {
    this.activeDiagramType = id;
    this.selectedTemplate = '';
    const firstTpl = this.templates[id]?.[0];
    if (firstTpl) {
      this.code = firstTpl.code;
      this.renderDiagram();
    }
  }

  applyTemplate(label: string) {
    if (!label) return;
    const tpl = this.currentTemplates.find(t => t.label === label);
    if (!tpl) return;
    this.code = tpl.code;
    this.selectedTemplate = label;
    this.renderDiagram();
  }

  onCodeChange() {
    if (this.renderTimer) clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(() => this.renderDiagram(), 800);
  }

  async renderDiagram() {
    if (!this.code.trim()) { this.svgContent = ''; this.error = ''; return; }
    this.loading = true;
    this.error = '';
    this.cdr.detectChanges();

    try {
      await this.loadMermaid();
      const id = `mermaid-render-${++this.renderCounter}`;
      const mermaid = (window as any).mermaid;
      mermaid.initialize({ startOnLoad: false, theme: this.theme, securityLevel: 'loose' });
      const { svg } = await mermaid.render(id, this.code);
      this.svgContent = svg;
      this.error = '';
    } catch (e: any) {
      this.error = e?.message ?? 'Erreur de syntaxe dans le diagramme.';
      this.svgContent = '';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async clearConfirm() {
    if (!(await this.dialogs.confirm({ title: 'Effacer le diagramme en cours ?', message: 'Le code du diagramme sera perdu.', icon: 'bi-eraser', tone: 'danger', confirmText: 'Effacer' }))) return;
    this.code = '';
    this.svgContent = '';
    this.error = '';
    this.selectedTemplate = '';
  }

  exportSVG() {
    if (!this.svgContent) { this.dialogs.toast('Aucun diagramme à exporter.', 'warning'); return; }
    const blob = new Blob([this.svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagramme-uml-${this.activeDiagramType}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportPNG() {
    if (!this.svgContent) { this.dialogs.toast('Aucun diagramme à exporter.', 'warning'); return; }
    const canvas = document.createElement('canvas');
    const img = new Image();
    const svgBlob = new Blob([this.svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.download = `diagramme-uml-${this.activeDiagramType}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = url;
  }

  exportCode() {
    const data = JSON.stringify({ type: this.activeDiagramType, code: this.code });
    this.dialogs.prompt({ title: 'Exporter le diagramme', message: 'Copiez ce JSON pour sauvegarder votre diagramme.', icon: 'bi-box-arrow-up', value: data, readonly: true });
  }

  async importCode() {
    const json = await this.dialogs.prompt({ title: 'Importer un diagramme', message: 'Collez le JSON exporté précédemment.', icon: 'bi-box-arrow-in-down', multiline: true, confirmText: 'Importer' });
    if (!json) return;
    try {
      const parsed = JSON.parse(json);
      if (parsed.type && parsed.code) {
        this.activeDiagramType = parsed.type;
        this.code = parsed.code;
        this.renderDiagram();
      }
    } catch {
      this.dialogs.toast('JSON invalide.', 'danger');
    }
  }

  zoomIn() { this.zoom = Math.min(this.zoom + 0.1, 3); }
  zoomOut() { this.zoom = Math.max(this.zoom - 0.1, 0.3); }

  markComplete() {
    if (!this.exercise) return;
    this.markingComplete = true;
    this.progressService.completeLesson(this.exercise.id).subscribe({
      next: () => { this.exercise!.completed = true; this.markingComplete = false; },
      error: () => { this.markingComplete = false; }
    });
  }

  private loadMermaid(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).mermaid) { resolve(); return; }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
      script.onload = () => {
        (window as any).mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
        resolve();
      };
      script.onerror = () => reject(new Error('Impossible de charger Mermaid.js'));
      document.head.appendChild(script);
    });
  }
}
