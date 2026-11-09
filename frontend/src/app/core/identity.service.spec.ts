import { TestBed } from '@angular/core/testing';
import { IdentityService } from './identity.service';

describe('IdentityService', () => {
  beforeEach(() => localStorage.clear());

  it('mémorise le pseudo dans le navigateur', () => {
    const svc = TestBed.inject(IdentityService);
    svc.setName('  Lucas ');
    expect(svc.name()).toBe('Lucas');
    expect(localStorage.getItem('ck:name')).toBe('Lucas');
  });

  it('enregistre et relit les jetons de session', () => {
    const svc = TestBed.inject(IdentityService);
    svc.save('s1', { participantId: 'p1', participantToken: 't', creatorToken: 'c', name: 'Thomas' });
    expect(svc.get('s1')?.creatorToken).toBe('c');
    svc.forget('s1');
    expect(svc.get('s1')).toBeNull();
  });

  it('ignore une valeur corrompue', () => {
    localStorage.setItem('ck:session:s2', '{oops');
    expect(TestBed.inject(IdentityService).get('s2')).toBeNull();
  });
});
