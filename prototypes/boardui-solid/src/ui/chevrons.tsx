// BoardUI's custom chevrons (components/foundations/icons/chevrons.tsx, MIT).
export function ChevronDownSmall(props: { class?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" class={props.class}>
      <path
        d="M4 7L7.29289 10.2929C7.68342 10.6834 8.31658 10.6834 8.70711 10.2929L12 7"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  );
}

export function ChevronUpDownSmall(props: { class?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" class={props.class}>
      <g transform="translate(4.25 2.56)">
        <path
          d="M0.75 7.43934L3.21967 9.90901C3.51256 10.2019 3.98744 10.2019 4.28033 9.90901L6.75 7.43934"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
        <path
          d="M0.75 3.43934L3.21967 0.96967C3.51256 0.676777 3.98744 0.676777 4.28033 0.96967L6.75 3.43934"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </g>
    </svg>
  );
}
