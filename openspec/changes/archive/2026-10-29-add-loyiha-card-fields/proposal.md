# Change: add-loyiha-card-fields

## Why
Sales gave the field list of the order card ("КАРТОЧКА МАЛУМОТЛАРИ"). The Loyiha must hold all of it so
sales stops keeping a parallel Excel, and so procurement / MRP later read area and product types per order.

## Field mapping (card → system)
| Card | Where | Notes |
|---|---|---|
| № заказа | `Project.code` (LY-26-00001) | auto; shown as "Buyurtma №" |
| Заказчик ФИО | `client` | existing |
| Адрес | `object_address` | existing |
| Сумма заказа | `amount` | existing, relabelled "Buyurtma summasi" |
| Сумма услуги | `service_amount` | new — installation/delivery services |
| Сумма аванса | `advance_amount` | new |
| Сумма задолжности | `debt_amount` = amount + service − advance | computed, never stored |
| Дата продажи | `sale_date` | new |
| Срок сдачи | `deadline` | existing |
| Телефон | `phone` | new; filled from the client when picked, editable per order |
| Сотувчи исми | `manager` | existing, relabelled "Sotuvchi" |
| Партнер исми | `partner` → Client of kind *dealer/partner* | new |
| Канал сбыта | `sales_channel` → reference list | new |
| Тип заказа + квадратура each | `ProjectItem(product_type, area_m2, quantity)` lines | new; types: Termo, PVX, Novation, Kolenoe, Aldoks (editable list) |
| Бренд ва махсулот номи | `brand` → reference list + `product_name` | new |
| Сегмент клиента | `Client.segment` → reference list | new; shown on the order card, edited on the client |
| Сумма квадратуры | `total_area` = Σ lines.area_m2 | computed |
| Кол-во изделий | `total_quantity` = Σ lines.quantity | computed |
| Локация | `location` | new; map link or coordinates |
| Чертеж | `ProjectFile` attachments | new; several files, downloadable |
| Маскитка | `mosquito_net` | new, yes/no |
| Демонтаж | `dismantling` | new, yes/no |
| Примечание | `notes` | existing |

## What changes
- New app **references**: one table of editable lists (`sales_channel`, `product_type`, `brand`,
  `client_segment`) with a settings page "Ma'lumotnomalar". Seeded with sensible defaults.
- **projects**: fields above, order lines, drawings (upload/download/delete), computed money and area.
- **Header lock refined**: after the order enters procurement, only production-relevant fields lock
  (client, lines, brand/product, mosquito net, dismantling). Money, phone, dates, location, notes stay
  editable — advances and debt change while the order is in the factory.
- All new fields are tracked in chatter; line changes and file uploads are written as events.

## Impact
- Tables: `references_refitem`, `projects_projectitem`, `projects_projectfile`; new columns on
  `projects_project`, `clients_client.segment`.
- Endpoints: `/references/`, `/projects/{id}/files/…`; project payload grows (`items`, totals, `debt_amount`).
- Page key `references` in the registry.
- Spec deltas: projects (fields, lines, files, lock), clients (segment), new `references` spec.
