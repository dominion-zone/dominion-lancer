import { JSX } from "solid-js";
import styles from "./Sidebar.module.css";
import { Link } from "@tanstack/solid-router";

export type SidebarProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "class">;

const Sidebar = (props: SidebarProps) => {
  return (
    <div {...props} class={styles.sidebar}>
      <ul class={styles.menu}>
        <li>
          <Link
            to="/"
            search={(v) => ({ network: v.network, user: v.user })}
            activeProps={{ class: styles.disabled }}
          >
            Home
          </Link>
        </li>
        <li>
          <Link
            to="/findings"
            search={(v) => ({ network: v.network, user: v.user })}
            activeProps={{ class: styles.disabled }}
          >
            Findings
          </Link>
        </li>
        <li>
          <Link
            to="/bug-bounties"
            search={(v) => ({ network: v.network, user: v.user })}
            activeProps={{ class: styles.disabled }}
          >
            Bug Bounties
          </Link>
        </li>
        <li>
          <Link
            to="/docs"
            search={(v) => ({ network: v.network, user: v.user })}
            activeProps={{ class: styles.disabled }}
          >
            Docs
          </Link>
        </li>
        <li>
          <Link
            to="/roadmap"
            search={(v) => ({ network: v.network, user: v.user })}
            activeProps={{ class: styles.disabled }}
          >
            Roadmap
          </Link>
        </li>
        <li>
          <Link
            to="/contacts"
            search={(v) => ({ network: v.network, user: v.user })}
            activeProps={{ class: styles.disabled }}
          >
            Contacts
          </Link>
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;
