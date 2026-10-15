/**
 * Nome da plataforma da videochamada, para a tela.
 *
 * As telas decidiam por `meetingUrl.includes('jitsi')`, mas o endereço do
 * Jitsi é `meet.jit.si`: a palavra "jitsi" não aparece nele. Resultado:
 * toda sessão no Jitsi, que é o provedor padrão do banco (010), aparecia
 * como "Google Meet". O provedor gravado no agendamento é a fonte certa;
 * o endereço só desempata quando ele falta.
 */
export function nomeDaPlataforma(provedor: string | null | undefined, url?: string | null): string {
  switch (provedor) {
    case 'jitsi': return 'Jitsi Meet';
    case 'google_meet': return 'Google Meet';
    case 'zoom': return 'Zoom';
    case 'manual': return 'link do profissional';
  }
  let host = '';
  try { host = url ? new URL(url).hostname : ''; } catch { host = ''; }
  if (host.endsWith('jit.si')) return 'Jitsi Meet';
  if (host === 'meet.google.com') return 'Google Meet';
  if (host.endsWith('zoom.us')) return 'Zoom';
  return 'videochamada';
}
