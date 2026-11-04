import { Link } from 'react-router-dom';
import { buttonClasses } from '../../components/ui/buttonStyles';
import { Chip } from '../../components/ui/Chip';
import { Notice } from '../../components/ui/Notice';
import { Panel, PanelHead } from '../../components/ui/Parts';
import type { AttentionItem } from './overview';

/** The list of things that need an administrator's or schedule maker's attention. */
export function AttentionPanel({ items, id }: { items: AttentionItem[]; id: string }) {
  return (
    <Panel aria-labelledby={id}>
      <PanelHead id={id} title="Needs your attention">
        {items.length > 0 && (
          <Chip tone="attention">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </Chip>
        )}
      </PanelHead>
      {items.length === 0 ? (
        <div className="p-5">
          <Notice tone="success" title="Everything is in order.">
            Every upcoming Sunday has a roster, nothing is waiting to be published, and no
            assignment has a problem.
          </Notice>
        </div>
      ) : (
        <ul className="m-0 list-none p-0">
          {items.map((item) => (
            <li
              key={item.key}
              className="grid items-center gap-x-4 gap-y-3 border-b border-line px-5 py-4 last:border-b-0 sm:grid-cols-[1fr_auto] md:px-6"
            >
              <div>
                <p className="font-bold text-deep">{item.title}</p>
                <p className="text-muted">{item.detail}</p>
              </div>
              <Link
                to={item.to}
                className={buttonClasses(
                  item.primary ? 'primary' : 'secondary',
                  'sm',
                  'max-sm:w-full',
                )}
              >
                {item.action}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
