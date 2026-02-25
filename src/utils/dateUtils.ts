export function getCurrentBrasiliaTime(): Date {
  // Cria uma data com o timezone 'America/Sao_Paulo'
  const now = new Date();
  
  // Usar Intl para obter as partes da data no fuso correto
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const dateParts: any = {};
  parts.forEach(({ type, value }) => {
    dateParts[type] = value;
  });

  // Criar uma nova data com os valores corretos
  return new Date(
    parseInt(dateParts.year),
    parseInt(dateParts.month) - 1,
    parseInt(dateParts.day),
    parseInt(dateParts.hour),
    parseInt(dateParts.minute),
    parseInt(dateParts.second)
  );
}

export function formatBrasiliaDate(dateString: string | Date, includeTime = true): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(includeTime && {
      hour: '2-digit',
      minute: '2-digit',
    })
  }).format(date);
}

export function isCouponExpired(expirationDate?: string | null): boolean {
  if (!expirationDate) return false;
  
  const now = getCurrentBrasiliaTime();
  const expiration = new Date(expirationDate);
  
  // Ajustar expiração para o final do dia (23:59:59) se não tiver hora
  if (expirationDate.indexOf('T') === -1) {
    expiration.setHours(23, 59, 59, 999);
  }
  
  return now > expiration;
}