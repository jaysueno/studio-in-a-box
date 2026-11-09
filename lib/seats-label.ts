/** "1 seat left", "4 seats left", and "no seats left" for zero or unknown. */
export function seatsLabel(n: number | null | undefined): string {
  if (!n || n < 1) return 'no seats left';
  return n === 1 ? '1 seat left' : `${n} seats left`;
}
