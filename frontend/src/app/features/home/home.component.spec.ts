import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { SessionSummary } from '../../core/models';
import { RealtimeService, type LobbyHandlers } from '../../core/realtime.service';
import { HomeComponent } from './home.component';

const summary = (over: Partial<SessionSummary>): SessionSummary => ({
  id: 's1', code: '0554', type: 'CROUSTY', foodChoice: null, scheduledAt: new Date().toISOString(), description: null,
  status: 'OPEN', creatorName: 'Thomas', createdAt: '', closedAt: null, participantCount: 2, itemCount: 3, revision: 1,
  ...over,
});

class FakeRealtime {
  status = signal<'online'>('online');
  handlers: LobbyHandlers | null = null;
  watchLobby(h: LobbyHandlers) {
    this.handlers = h;
    return () => (this.handlers = null);
  }
}

describe('HomeComponent', () => {
  let rt: FakeRealtime;
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    rt = new FakeRealtime();
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RealtimeService, useValue: rt },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  const create = async (sessions: SessionSummary[] = []) => {
    const f = TestBed.createComponent(HomeComponent);
    http.expectOne('/api/sessions').flush({ sessions });
    await f.whenStable();
    return f;
  };

  it('affiche la question du prénom, les sessions et les deux catégories', async () => {
    const f = await create();
    const el = f.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Comment tu t’appelles');
    expect(el.textContent).toContain('Aucune session en cours');
    expect(el.textContent).toContain('Commander un Crousty');
    expect(el.textContent).toContain('Organiser une sortie Tacos / Kebab');
  });

  it('affiche les sessions en direct, ouvertes en premier et clôturées en gris', async () => {
    const f = await create([summary({ id: 'a', code: '1111', status: 'CLOSED', closedAt: new Date().toISOString() })]);
    rt.handlers!.onSession(summary({ id: 'b', code: '2222', type: 'TACOS_KEBAB', itemCount: 1 }));
    await f.whenStable();
    const items = [...(f.nativeElement as HTMLElement).querySelectorAll('.sess')];
    expect(items.map((i) => i.querySelector('.sess__code')!.textContent)).toEqual(['#2222', '#1111']);
    expect(items[1]!.classList.contains('sess--closed')).toBe(true);
    expect(items[0]!.textContent).toContain('Rejoindre');
    expect(items[1]!.textContent).toContain('Voir');

    // La session ouverte se ferme en direct → passe en gris
    rt.handlers!.onSession(summary({ id: 'b', code: '2222', type: 'TACOS_KEBAB', status: 'CLOSED', closedAt: new Date().toISOString(), revision: 2 }));
    await f.whenStable();
    expect((f.nativeElement as HTMLElement).querySelectorAll('.sess--closed').length).toBe(2);
  });

  it('exige un prénom pour rejoindre une session ouverte depuis la liste', async () => {
    const f = await create([summary({})]);
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const s = f.componentInstance.sessions()[0]!;
    f.componentInstance.openSession(s);
    expect(nav).not.toHaveBeenCalled();
    expect(f.componentInstance.nameError()).toBeTruthy();

    f.componentInstance.onNameInput('Lucas');
    f.componentInstance.openSession(s);
    expect(nav).toHaveBeenCalledWith(['/session', '0554'], { queryParams: { rejoindre: 1 } });
  });

  it('permet de voir une session clôturée sans prénom', async () => {
    const f = await create([summary({ status: 'CLOSED', closedAt: new Date().toISOString() })]);
    const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    f.componentInstance.openSession(f.componentInstance.sessions()[0]!);
    expect(nav).toHaveBeenCalledWith(['/session', '0554']);
  });

  it('exige un prénom avant de créer une session', async () => {
    const f = await create();
    const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    f.componentInstance.create('crousty');
    expect(nav).not.toHaveBeenCalled();
    f.componentInstance.onNameInput('Thomas');
    f.componentInstance.create('crousty');
    expect(nav).toHaveBeenCalledWith(['/creer', 'crousty']);
    expect(localStorage.getItem('ck:name')).toBe('Thomas');
  });

  it('garde la possibilité de rejoindre avec un code', async () => {
    const f = await create();
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
