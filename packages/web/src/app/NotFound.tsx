import { Link } from '@tanstack/react-router';
import { Page } from './Page';

export function NotFound() {
  return (
    <Page title="Not found">
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-title-3-medium text-text-primary">
          Nothing lives here
        </p>
        <Link
          to="/"
          className="text-body-medium text-accent-600 hover:underline"
        >
          Start a new session
        </Link>
      </div>
    </Page>
  );
}
