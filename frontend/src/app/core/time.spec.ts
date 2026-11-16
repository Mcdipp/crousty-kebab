import { dateTimeToDate, dayValue, defaultTimeValue, formatHour, formatWhen, timeValueToDate } from './time';

describe('time utils', () => {
  it('formate une heure au format 21h30', () => {
    expect(formatHour(new Date(2026, 10, 9, 21, 30))).toBe('21h30');
    expect(formatHour(new Date(2026, 10, 9, 7, 5))).toBe('07h05');
  });

  it("propose une heure par défaut arrondie au quart d'heure", () => {
    expect(defaultTimeValue(new Date(2026, 10, 9, 20, 7))).toBe('20:45');
    expect(defaultTimeValue(new Date(2026, 10, 9, 23, 50))).toBe('00:30');
  });

  it("convertit HH:mm en date d'aujourd'hui ou de demain", () => {
    const now = new Date(2026, 10, 9, 23, 50);
    const sameDay = timeValueToDate('23:55', now)!;
    expect(sameDay.getDate()).toBe(9);
    const nextDay = timeValueToDate('00:30', now)!;
    expect(nextDay.getDate()).toBe(10);
    expect(nextDay.getHours()).toBe(0);
    expect(timeValueToDate('25:00', now)).toBeNull();
    expect(timeValueToDate('abc', now)).toBeNull();
  });

  it('combine une date et une heure, et refuse les valeurs invalides', () => {
    const d = dateTimeToDate('2026-11-17', '12:00')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 10, 17, 12, 0]);
    expect(dateTimeToDate('2026-02-30', '12:00')).toBeNull();
    expect(dateTimeToDate('', '12:00')).toBeNull();
    expect(dateTimeToDate('2026-11-17', '')).toBeNull();
  });

  it('calcule les jours relatifs', () => {
    const now = new Date(2026, 10, 30, 22, 0);
    expect(dayValue(0, now)).toBe('2026-11-30');
    expect(dayValue(1, now)).toBe('2026-12-01');
  });

  it('formate un rendez-vous de façon lisible', () => {
    const now = new Date(2026, 10, 16, 9, 0);
    expect(formatWhen(new Date(2026, 10, 16, 19, 30), now)).toBe('aujourd’hui à 19h30');
    expect(formatWhen(new Date(2026, 10, 17, 12, 0), now)).toBe('demain à 12h00');
    expect(formatWhen(new Date(2026, 10, 19, 12, 0), now)).toBe('jeudi 19 novembre à 12h00');
  });
});
