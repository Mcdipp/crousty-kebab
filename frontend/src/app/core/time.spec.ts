import { defaultTimeValue, formatHour, timeValueToDate } from './time';

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
});
