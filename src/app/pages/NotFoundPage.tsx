import { Link } from 'react-router-dom';
import { buttonClasses } from '../../components/ui/buttonStyles';
import { EmptyState } from '../../components/ui/States';

export function NotFoundPage() {
  return (
    <div className="mx-auto grid min-h-screen max-w-lg place-items-center p-6">
      <EmptyState
        title="We couldn’t find that page"
        action={
          <Link to="/" className={buttonClasses('primary')}>
            Go to the home screen
          </Link>
        }
      >
        The link may be old or mistyped.
      </EmptyState>
    </div>
  );
}
