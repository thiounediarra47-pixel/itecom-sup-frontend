import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'roleLabel', standalone: true })
export class RoleLabelPipe implements PipeTransform {
  transform(role: string): string {
    switch (role) {
      case 'ROLE_STUDENT': return 'Étudiant';
      case 'ROLE_TEACHER': return 'Professeur';
      case 'ROLE_ADMIN': return 'Admin';
      default: return role;
    }
  }
}
