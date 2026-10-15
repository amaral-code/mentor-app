import { describe, expect, it } from 'vitest';
import { nomeDaPlataforma } from '../salaVirtual';

describe('nomeDaPlataforma', () => {
  it('Jitsi é Jitsi, mesmo com o endereço meet.jit.si (o bug: virava "Google Meet")', () => {
    expect(nomeDaPlataforma('jitsi', 'https://meet.jit.si/MidnightMentorAbc')).toBe('Jitsi Meet');
    expect(nomeDaPlataforma(null, 'https://meet.jit.si/MidnightMentorAbc')).toBe('Jitsi Meet');
  });

  it('o provedor gravado vence o endereço', () => {
    expect(nomeDaPlataforma('google_meet', 'https://meet.google.com/abc-defg-hij')).toBe('Google Meet');
    expect(nomeDaPlataforma('zoom', null)).toBe('Zoom');
    expect(nomeDaPlataforma('manual', 'https://exemplo.com/sala')).toBe('link do profissional');
  });

  it('sem provedor nem endereço conhecido, não inventa marca', () => {
    expect(nomeDaPlataforma(undefined, undefined)).toBe('videochamada');
    expect(nomeDaPlataforma(undefined, 'endereço inválido')).toBe('videochamada');
  });
});
