/**
 * Les sept fondamentales et leur couleur.
 *
 * Reprise telle quelle de l'ancienne page : elle explique la règle du code
 * couleur — une couleur par fondamentale — là où l'aperçu de mesure en montre
 * l'effet. Les deux sont complémentaires.
 */
const NOTES = [
  { note: 'C', color: '#dc2626' },
  { note: 'D', color: '#ea580c' },
  { note: 'E', color: '#ca8a04' },
  { note: 'F', color: '#16a34a' },
  { note: 'G', color: '#0891b2' },
  { note: 'A', color: '#2563eb' },
  { note: 'B', color: '#7c3aed' },
];

export function ChordColorLegend() {
  return (
    <div className="flex gap-1.5">
      {NOTES.map(({ note, color }) => (
        <span
          key={note}
          className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded"
          style={{ borderLeft: `5px solid ${color}`, background: `${color}15` }}
        >
          {note}
        </span>
      ))}
    </div>
  );
}
