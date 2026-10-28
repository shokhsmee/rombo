import { AppShell, Avatar, Badge, Burger, Group, Menu, Text, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconBuildingFactory2,
  IconChevronDown,
  IconFileInvoice,
  IconLayoutDashboard,
  IconLogout,
  IconShieldLock,
  IconShoppingCart,
  IconUserCircle,
  IconUsers,
  IconUsersGroup,
  type Icon,
} from "@tabler/icons-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth, type PageKey } from "@/auth/AuthProvider";

type NavItem = { page: PageKey; label: string; to: string; icon: Icon; planned?: boolean };
type NavGroup = { title: string; items: NavItem[] };

// Same pages/keys as backend apps/access/registry.py
const NAV: NavGroup[] = [
  { title: "Umumiy", items: [{ page: "dashboard", label: "Bosh sahifa", to: "/", icon: IconLayoutDashboard }] },
  {
    title: "Savdo",
    items: [
      { page: "projects", label: "Loyihalar", to: "/projects", icon: IconFileInvoice },
      { page: "clients", label: "Mijozlar", to: "/clients", icon: IconUsersGroup },
    ],
  },
  {
    title: "Ta'minot va ishlab chiqarish",
    items: [
      { page: "procurement", label: "Xaridlar", to: "/procurement", icon: IconShoppingCart, planned: true },
      { page: "mrp", label: "MRP", to: "/mrp", icon: IconBuildingFactory2, planned: true },
    ],
  },
  { title: "Xodimlar", items: [{ page: "employees", label: "Xodimlar", to: "/employees", icon: IconUsers }] },
  {
    title: "Sozlamalar",
    items: [
      { page: "users", label: "Foydalanuvchilar", to: "/settings/users", icon: IconUserCircle },
      { page: "roles", label: "Rollar va ruxsatlar", to: "/settings/roles", icon: IconShieldLock },
    ],
  },
];

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function Layout() {
  const { me, can, logout } = useAuth();
  const [opened, { toggle, close }] = useDisclosure();
  const navigate = useNavigate();

  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(i.page)) })).filter((g) => g.items.length);

  return (
    <AppShell
      header={{ height: 48 }}
      navbar={{ width: 236, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding={0}
    >
      <AppShell.Header className="shell-header">
        <Group h="100%" px="md" justify="space-between">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <div />
          <Menu position="bottom-end" width={220} shadow="md">
            <Menu.Target>
              <UnstyledButton>
                <Group gap={8}>
                  <Avatar size={26} radius="sm" color="ink">
                    {initials(me?.full_name ?? "?")}
                  </Avatar>
                  <div style={{ lineHeight: 1.1 }}>
                    <Text size="sm" fw={500}>{me?.full_name}</Text>
                    <Text size="xs" c="dimmed">
                      {me?.is_superuser ? "Superuser" : me?.roles.map((r) => r.name).join(", ") || "Rol yo'q"}
                    </Text>
                  </div>
                  <IconChevronDown size={14} stroke={1.6} />
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{me?.username}</Menu.Label>
              <Menu.Item leftSection={<IconLogout size={15} />} onClick={() => { logout(); navigate("/login"); }}>
                Chiqish
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar className="shell-nav">
        <div className="brand">
          <span className="brand-mark">
            <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1 11 6 6 11 1 6Z" fill="none" stroke="#fff" strokeWidth="1.6" /></svg>
          </span>
          ROMBO
          <Text span size="xs" c="dimmed" fw={400}>ERP</Text>
        </div>
        <AppShell.Section grow style={{ overflowY: "auto" }}>
          {groups.map((g) => (
            <div className="nav-group" key={g.title}>
              <div className="nav-group-title">{g.title}</div>
              {g.items.map((item) =>
                item.planned ? (
                  <div className="nav-link" data-disabled="true" key={item.to} title="Keyingi bosqichda">
                    <item.icon size={17} stroke={1.5} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <Badge size="xs" color="gray" variant="outline">tez orada</Badge>
                  </div>
                ) : (
                  <NavLink key={item.to} to={item.to} end={item.to === "/"} className="nav-link" onClick={close}>
                    <item.icon size={17} stroke={1.5} />
                    {item.label}
                  </NavLink>
                ),
              )}
            </div>
          ))}
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <div className="page">
          <Outlet />
        </div>
      </AppShell.Main>
    </AppShell>
  );
}
