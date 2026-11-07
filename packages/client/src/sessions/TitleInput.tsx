import { renameSession } from './sessions';
import InlineInput from '../ui/InlineInput';

export default function TitleInput(props: {
  id: string;
  value: string;
  onClose: () => void;
  class?: string;
}) {
  return (
    <InlineInput
      value={props.value}
      label="Session title"
      maxlength={200}
      class={props.class}
      onSave={(title) =>
        renameSession(props.id, title).catch((error) =>
          console.error('[rename]', error),
        )
      }
      onClose={props.onClose}
    />
  );
}
