import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Crousty & Kebab — Commandes entre amis',
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'creer/crousty',
    title: 'Nouvelle session Crousty',
    data: { type: 'CROUSTY' },
    loadComponent: () => import('./features/create/create-session.component').then((m) => m.CreateSessionComponent),
  },
  {
    path: 'creer/tacos-kebab',
    title: 'Nouvelle sortie Tacos / Kebab',
    data: { type: 'TACOS_KEBAB' },
    loadComponent: () => import('./features/create/create-session.component').then((m) => m.CreateSessionComponent),
  },
  {
    path: 'session/:code',
    title: 'Session — Crousty & Kebab',
    loadComponent: () => import('./features/session/session-page.component').then((m) => m.SessionPageComponent),
  },
  { path: '**', redirectTo: '' },
];
