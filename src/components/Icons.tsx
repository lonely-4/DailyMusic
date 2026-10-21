type IconName = 'music' | 'search' | 'download' | 'sun' | 'moon' | 'image';

const PATHS: Record<IconName, string> = {
  music: 'M9 18V6l10-2v12',
  search: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm5-2 4 4',
  download: 'M12 4v11m0 0 4-4m-4 4-4-4M5 20h14',
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 2v2m0 16v2M4 12H2m20 0h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z',
  image: 'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11ZM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM5 17l4.2-4.2a1 1 0 0 1 1.4 0L13 15l1.8-1.8a1 1 0 0 1 1.4 0L20 17',
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {name === 'music' ? (
        <>
          <path d={PATHS.music} />
          <circle cx="7" cy="18" r="3" />
          <circle cx="17" cy="16" r="3" />
        </>
      ) : (
        <path d={PATHS[name]} />
      )}
    </svg>
  );
}
