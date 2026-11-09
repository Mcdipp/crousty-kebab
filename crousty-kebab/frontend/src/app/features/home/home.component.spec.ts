import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('affiche les deux catégories et la question du prénom', async () => {
    const f = TestBed.createComponent(HomeComponent);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Comment tu t’appelles');
    expect(el.textContent).toContain('Commander un Crousty');
    expect(el.textContent).toContain('Organiser une sortie Tacos / Kebab');
  });

  it('exige un prénom avant de créer une session', async () => {
    const f = TestBed.createComponent(HomeComponent);
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    f.componentInstance.create('crousty');
    await f.whenStable();
    expect(nav).not.toHaveBeenCalled();
    expect(f.componentInstance.nameError()).toBeTruthy();

    f.componentInstance.onNameInput('Thomas');
    f.componentInstance.create('crousty');
    expect(nav).toHaveBeenCalledWith(['/creer', 'crousty']);
    expect(localStorage.getItem('ck:name')).toBe('Thomas');
  });

  it('valide le code à 4 chiffres et interroge l’API', async () => {
    const f = TestBed.createComponent(HomeComponent);
    const http = TestBed.inject(HttpTestingController);
    const c = f.componentInstance;
    c.onNameInput('Lucas');
    c.onCodeInput('12a');
    expect(c.code()).toBe('12');
    await c.join();
    expect(c.joinError()).toContain('4 chiffres');

    c.onCodeInput('9999');
    const p = c.join();
    http.expectOne('/api/sessions/9999').flush(
      { error: { code: 'NOT_FOUND', message: 'Aucune session trouvée avec ce code.' } },
      { status: 404, statusText: 'Not Found' },
    );
    await p;
    expect(c.joinError()).toContain('Aucune session');
    http.verify();
  });
});
