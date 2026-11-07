import type { JSX } from '@solidjs/web';

/** An error the user should read: what failed and, ideally, why. */
export default function Alert(props: {
  children: JSX.Element;
  class?: string;
}) {
  return (
    <p
      class={[
        'rounded-lg bg-danger/10 px-2.5 py-2 text-meta break-words whitespace-pre-wrap text-danger',
        props.class,
      ]}
      role="alert"
    >
      {props.children}
    </p>
  );
}
