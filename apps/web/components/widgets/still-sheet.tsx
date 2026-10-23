export type StillSheetItem = {
  id: string;
  src: string;
  title: string;
  caption: string;
};

export function StillSheet({
  items,
  onSelect,
}: {
  items: StillSheetItem[];
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="still-sheet">
      {items.map((item, index) => (
        <li key={item.id}>
          <button type="button" className="still-frame" onClick={() => onSelect(item.id)}>
            <span className="still-plate">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.src} alt="" width={320} height={180} loading="lazy" />
              <span className="finder-corners" aria-hidden="true"><span /></span>
              <span className="still-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            </span>
            <span className="still-caption">
              <b>{item.title}</b>
              <span>{item.caption}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
