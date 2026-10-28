import { Group, Title } from "@mantine/core";
import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";

type Crumb = { label: string; to?: string };

export function PageHeader({ title, crumbs = [], actions, extra }: {
  title: ReactNode;
  crumbs?: Crumb[];
  actions?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {crumbs.length > 0 && (
          <div className="crumbs">
            {crumbs.map((c, i) => (
              <Fragment key={i}>
                {i > 0 && " / "}
                {c.to ? <Link to={c.to}>{c.label}</Link> : c.label}
              </Fragment>
            ))}
          </div>
        )}
        <Group gap="sm" align="center">
          <Title order={1}>{title}</Title>
          {extra}
        </Group>
      </div>
      {actions && <Group gap="xs">{actions}</Group>}
    </div>
  );
}
