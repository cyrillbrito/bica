import { Show, createSignal } from 'solid-js';

import { updateProject, useProjects } from './projects';
import Alert from '../ui/Alert';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';
import { errorText } from '../ui/errors';

let dialog: HTMLDialogElement | undefined;
const [projectId, setProjectId] = createSignal<string>();

export function openEditProject(id: string) {
  setProjectId(id);
  dialog?.showModal();
}

/** Renames one project. */
export default function EditProject() {
  const projects = useProjects();
  const project = () => projects().find((p) => p.id === projectId());
  const [name, setName] = createSignal('', { name: 'editProjectName' });
  const [error, setError] = createSignal('', { name: 'editProjectError' });
  const [saving, setSaving] = createSignal(false, {
    name: 'editProjectSaving',
  });

  // Filled on open, so a poll landing mid-edit doesn't undo what you typed.
  const fill = () => {
    setName(project()?.name ?? '');
    setError('');
  };

  const save = async (e: SubmitEvent) => {
    e.preventDefault();
    const id = projectId();
    if (!id || !name().trim()) return;
    setSaving(true);
    try {
      await updateProject(id, { name: name() });
      dialog?.close();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      ref={(el) => (dialog = el)}
      title="Edit project"
      onOpen={fill}
      footer={
        <Button
          variant="primary"
          type="submit"
          form="edit-project"
          loading={saving()}
          disabled={!name().trim()}
        >
          Save
        </Button>
      }
    >
      <form
        id="edit-project"
        class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 *:shrink-0"
        onSubmit={save}
      >
        <Show when={error()}>
          <Alert>{error()}</Alert>
        </Show>
        <p
          class="truncate text-left font-mono text-meta text-muted [direction:rtl]"
          title={project()?.path}
        >
          <bdi>{project()?.path}</bdi>
        </p>
        <Field label="Name" value={name()} onInput={setName} required />
      </form>
    </Dialog>
  );
}
