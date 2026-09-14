# Design system — Национальный реестр компетенций

Единый визуальный язык: Layout + SearchPage (синий бренд, серый фон страницы).

## Tokens (`src/styles/theme.css`)

| Token | Value | Use |
|-------|-------|-----|
| `--primary` / `bg-primary` | `#1E40AF` | Buttons, links, logo, active nav |
| `--page` / `bg-page` | `#F5F7FA` | Page background (Layout) |
| `--nav` / `bg-nav` | `#FAFBFC` | Secondary nav strip |
| `--footer` | `#1F2937` | Footer |
| Font | Manrope | All UI |

Do not hardcode `#1E40AF` / `#F5F7FA` in new code — use tokens / utilities.

## Page layout

- Width: `PageShell` or `.page-shell` → `max-w-[1440px] mx-auto px-8 py-8`
- Narrow (detail / wizard): `PageShell narrow` / `.page-shell-narrow` → `max-w-5xl`
- Header: `PageHeader` → `.page-title` + `.page-subtitle` + optional actions
- Workspace routes already wrap content in `PageShell` via `routes.tsx`

## Surfaces & forms

- Panels: `.surface` / `.surface-padded` or shadcn `Card` (`rounded-xl`)
- Native controls: `.form-control`
- Tables: `.data-table`
- Status chips: `.status-pill` + colors from `competenceMappers.statusColors`

## Components

- Prefer `@/components/ui/*` (Button, Input, Card, Badge, Tabs…)
- Primary Button = brand blue (token). Green/red only for semantic approve/reject.
- Ant Design (Strategic Session): wrap with `ConfigProvider` `colorPrimary: #1E40AF`, Manrope — do not introduce new antd pages.

## Heroes

Home / Integration: gradient `from-[#1E3A8A] via-[#1E40AF] to-[#3B82F6]` only on marketing heroes.
