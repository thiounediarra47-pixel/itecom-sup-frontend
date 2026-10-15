export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: 'ROLE_STUDENT' | 'ROLE_TEACHER' | 'ROLE_ADMIN';
  specialization?: 'genie-logiciel' | 'reseau' | 'comptabilite' | 'sante' | 'marketing-digital' | 'developpement-personnel';
  avatarUrl?: string;
  bio?: string;
  enabled: boolean;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  user: User;
}

export interface LoginRequest { email: string; password: string; }

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: 'ROLE_STUDENT' | 'ROLE_TEACHER';
  specialization?: 'genie-logiciel' | 'reseau' | 'comptabilite' | 'sante' | 'marketing-digital' | 'developpement-personnel';
  paymentMethod: string;
  paymentPhone: string;
  paymentReference: string;
}
