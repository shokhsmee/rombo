import { Anchor, Grid, Paper, SimpleGrid, Text, Title } from "@mantine/core";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { StatusDot } from "@/components/StatusBadge";
import { fmtDate } from "@/lib/format";
import { projectsApi, useProjectSummary, type ProjectStatus } from "@/modules/projects/api";
import { STATUS } from "@/modules/projects/statuses";

const ACTIVE: ProjectStatus[] = ["confirmed", "procurement", "production", "ready"];

export function DashboardPage() {
  const { me, can } = useAuth();
  const canProjects = can("projects");
  const summary = useProjectSummary();
  const overdue = projectsApi.useList({ overdue: "true", size: 8, sort: "deadline" }, { enabled: canProjects });
  const soon = projectsApi.useList(
    { status: ACTIVE, size: 8, sort: "deadline" },
    { enabled: canProjects },
  );
  const counts = Object.fromEntries((summary.data ?? []).map((s) => [s.status, s.count])) as Record<string, number>;
  const navigate = useNavigate();

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Xayrli tong" : hour < 18 ? "Xayrli kun" : "Xayrli kech";

  if (!canProjects) {
    return <PageHeader title={`${greet}, ${me?.full_name.split(" ")[0]}`} />;
  }

  return (
    <>
      <PageHeader title={`${greet}, ${me?.full_name.split(" ")[0]}`} crumbs={[{ label: "Bosh sahifa" }]} />

      <Paper mb="md" p={0}>
        <SimpleGrid cols={{ base: 2, sm: 4, lg: 7 }} spacing={0}>
          {(["draft", "confirmed", "procurement", "production", "ready", "delivered", "cancelled"] as ProjectStatus[]).map((s, i) => (
            <div
              key={s}
              className="stat"
              style={{ borderLeft: i ? "1px solid var(--r-border)" : undefined, cursor: "pointer" }}
              onClick={() => navigate(`/projects?status=${s}`)}
            >
              <div className="stat-value">{counts[s] ?? 0}</div>
              <StatusDot color={STATUS[s].color} label={STATUS[s].label} />
            </div>
          ))}
        </SimpleGrid>
      </Paper>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <ProjectPanel title="Muddati o'tgan" link="/projects?overdue=true" items={overdue.data?.items} danger
            empty="Muddati o'tgan loyiha yo'q" />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <ProjectPanel title="Jarayondagi loyihalar — muddat bo'yicha"
            link={`/projects?${ACTIVE.map((s) => `status=${s}`).join("&")}&sort=deadline`} items={soon.data?.items}
            empty="Jarayonda loyiha yo'q" />
        </Grid.Col>
      </Grid>
    </>
  );
}

function ProjectPanel({ title, link, items, danger, empty }: {
  title: string;
  link: string;
  items?: { id: number; code: string; name: string; deadline: string | null; client: { name: string } }[];
  danger?: boolean;
  empty: string;
}) {
  const navigate = useNavigate();
  return (
    <Paper p={0}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--r-border)" }}>
        <Title order={2}>{title}</Title>
        <Anchor component={Link} to={link} size="sm">Barchasi →</Anchor>
      </div>
      <table className="dt dt-fixed">
        <tbody>
          {items?.map((p) => (
            <tr key={p.id} data-clickable="true" onClick={() => navigate(`/projects/${p.id}`)}>
              <td style={{ width: 112 }}><span className="mono">{p.code}</span></td>
              <td>
                <Text size="sm" fw={500} truncate>{p.name}</Text>
              </td>
              <td className="muted" style={{ width: "34%" }}>{p.client.name}</td>
              <td style={{ width: 96 }}>
                <Text size="sm" c={danger ? "red.7" : undefined}>{fmtDate(p.deadline)}</Text>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items && items.length === 0 && <div className="dt-empty">{empty}</div>}
    </Paper>
  );
}
