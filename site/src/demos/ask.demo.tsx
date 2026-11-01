import AskCard from '@client/sessions/AskCard';
import { mount } from './mount';

// Answers stay on the page: nothing is sent anywhere.
export default (host: HTMLElement) =>
  mount(host, () => (
    <div class="max-w-xl">
      <AskCard
        open
        onAnswer={async (text) => console.log('Answer:', text)}
        questions={[
          {
            header: 'Storage',
            question: 'Where should the drafts be kept?',
            options: [
              {
                label: 'SQLite (Recommended)',
                description: 'Next to the sessions, backed up with them.',
              },
              {
                label: 'Files',
                description: 'One Markdown file per draft in the worktree.',
              },
            ],
          },
        ]}
      />
    </div>
  ));
