import { describe, expect, it } from 'vitest';
import { credencialDoLink, emailValido } from '../linkDeEntrada';

describe('credencialDoLink', () => {
  it('PKCE: código na consulta', () => {
    expect(credencialDoLink('midnightmentor://entrar?code=abc123')).toEqual({ tipo: 'codigo', codigo: 'abc123' });
  });
  it('implícito: tokens no fragmento', () => {
    expect(credencialDoLink('midnightmentor://entrar#access_token=a.b.c&refresh_token=r1&type=magiclink')).toEqual({
      tipo: 'tokens',
      accessToken: 'a.b.c',
      refreshToken: 'r1',
    });
  });
  it('link expirado vira mensagem que o aluno entende', () => {
    expect(credencialDoLink('midnightmentor://entrar#error=access_denied&error_description=Email+link+is+invalid+or+has+expired')).toEqual({
      tipo: 'erro',
      mensagem: 'O link expirou ou já foi usado. Peça outro.',
    });
  });
  it('link sem credencial não faz nada', () => {
    expect(credencialDoLink('midnightmentor://quiz')).toEqual({ tipo: 'nada' });
    expect(credencialDoLink(null)).toEqual({ tipo: 'nada' });
  });
});

describe('emailValido', () => {
  it('formato básico', () => {
    expect(emailValido(' ana@escola.com.br ')).toBe(true);
    expect(emailValido('ana@escola')).toBe(false);
    expect(emailValido('ana escola@x.com')).toBe(false);
  });
});
