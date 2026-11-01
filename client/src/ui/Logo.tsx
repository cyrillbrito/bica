// The Bica mark, a Portuguese bica cup on its saucer. Same drawing as public/favicon.svg and the PNG icons.
export function Logo(props: { size?: number; class?: string }) {
  return (
    <svg
      width={props.size ?? 20}
      height={props.size ?? 20}
      viewBox="0 0 32 32"
      class={props.class}
      aria-hidden="true"
    >
      <path
        d="M16 0C28 0 32 4 32 16S28 32 16 32 0 28 0 16 4 0 16 0Z"
        fill="#6c4122"
      />
      <g
        transform="translate(0.8 0.3)"
        fill="none"
        stroke="#fff"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M12.6 8.6c-.8-1.1.8-1.9 0-3M16.4 8.6c-.8-1.1.8-1.9 0-3"
          stroke-width="1.5"
        />
        <path d="M20 12.6h1.6a2.5 2.5 0 0 1 0 5h-2.4" stroke-width="2" />
        <path
          d="M8.5 10.5h12l-1.65 10.6q-.25 1.4-1.65 1.4h-5.4q-1.4 0-1.65-1.4Z"
          fill="#fff"
          stroke-width="1"
        />
        <path d="M6 24.6h17" stroke-width="2.2" />
      </g>
    </svg>
  );
}
