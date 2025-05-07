import {JSX} from 'solid-js';
import styles from './Sidebar.module.css';
import { Link } from '@tanstack/solid-router';

export type SidebarProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, 'class'>;

const Sidebar = (props: SidebarProps) => {
  return (
    <div {...props} class={styles.sidebar}>
      <ul class={styles.menu}>
        <li>
          <Link to="/" search={(v) => v}>
            Home
          </Link>
        </li>
        <li>
          <Link to="/my-findings" search={(v) => v}>
            Findings
          </Link>
        </li>
        <li>
          <Link to="/bug-bounties" search={(v) => v}>
            Bug Bounties
          </Link>
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;
